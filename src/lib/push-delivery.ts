import { createSign } from "node:crypto";
import { connect, constants } from "node:http2";
import { createClient } from "@supabase/supabase-js";
import type { NotificationPayload } from "@/lib/notifications";

type PushTokenRow = {
  id: string;
  token: string;
};

type ApnsConfig = {
  teamId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
  environment: "development" | "production";
  host: string;
};

type ApnsSendResult = {
  ok: boolean;
  status: number;
  reason?: string;
};

const PUSH_ALLOWED_NOTIFICATION_TYPES = new Set([
  "new_message",
  "message_reply",
  "reply",
  "follow",
  "admin_report",
]);

let pushServiceClient: ReturnType<typeof createClient> | null = null;
let cachedApnsJwt: { token: string; createdAtSeconds: number } | null = null;

function getPushServiceClient() {
  if (pushServiceClient) {
    return pushServiceClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  pushServiceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return pushServiceClient;
}

function getApnsPrivateKey() {
  const base64Key = process.env.APNS_PRIVATE_KEY_BASE64?.trim();

  if (base64Key) {
    return Buffer.from(base64Key, "base64").toString("utf8");
  }

  return process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim() ?? "";
}

function getApnsConfig(): ApnsConfig | null {
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const keyId = process.env.APNS_KEY_ID?.trim();
  const privateKey = getApnsPrivateKey();
  const bundleId = process.env.APNS_BUNDLE_ID?.trim() || "com.loombus.mobile";
  const requestedEnvironment = process.env.APNS_ENVIRONMENT?.trim();

  if (!teamId || !keyId || !privateKey || !bundleId) {
    return null;
  }

  const environment =
    requestedEnvironment === "production" ? "production" : "development";

  return {
    teamId,
    keyId,
    privateKey,
    bundleId,
    environment,
    host:
      environment === "production"
        ? "api.push.apple.com"
        : "api.sandbox.push.apple.com",
  };
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createApnsJwt(config: ApnsConfig) {
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (
    cachedApnsJwt &&
    nowSeconds - cachedApnsJwt.createdAtSeconds < 50 * 60
  ) {
    return cachedApnsJwt.token;
  }

  const header = {
    alg: "ES256",
    kid: config.keyId,
  };

  const claims = {
    iss: config.teamId,
    iat: nowSeconds,
  };

  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(claims)}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();

  const signature = signer.sign({
    key: config.privateKey,
    dsaEncoding: "ieee-p1363",
  });

  const token = `${signingInput}.${signature.toString("base64url")}`;

  cachedApnsJwt = {
    token,
    createdAtSeconds: nowSeconds,
  };

  return token;
}

function getNotificationUrl(payload: NotificationPayload) {
  if (payload.type === "admin_report") {
    return "/admin/reports";
  }

  if (payload.target_type === "discussion" && payload.target_id) {
    return `/discussions/${payload.target_id}`;
  }

  if (payload.target_type === "conversation") {
    return "/messages";
  }

  if (payload.target_type === "profile") {
    return "/notifications";
  }

  return "/notifications";
}

function getPushTitle(payload: NotificationPayload) {
  switch (payload.type) {
    case "new_message":
    case "message_reply":
      return "New Loombus message";
    case "reply":
      return "New Loombus reply";
    case "follow":
      return "New Loombus follower";
    case "admin_report":
      return "New Loombus report";
    default:
      return "Loombus notification";
  }
}

function cleanPushBody(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

function shouldSendNativePush(payload: NotificationPayload) {
  if (!PUSH_ALLOWED_NOTIFICATION_TYPES.has(payload.type)) {
    return false;
  }

  if (!payload.user_id) {
    return false;
  }

  return true;
}

async function sendApnsNotification(args: {
  config: ApnsConfig;
  token: string;
  title: string;
  body: string;
  url: string;
}): Promise<ApnsSendResult> {
  const jwt = createApnsJwt(args.config);
  const payload = JSON.stringify({
    aps: {
      alert: {
        title: args.title,
        body: args.body,
      },
      sound: "default",
    },
    url: args.url,
  });

  return new Promise((resolve) => {
    const client = connect(`https://${args.config.host}`);
    let status = 0;
    let responseBody = "";
    let settled = false;

    function finish(result: ApnsSendResult) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      client.close();
      resolve(result);
    }

    const timeout = setTimeout(() => {
      finish({
        ok: false,
        status: 0,
        reason: "APNs request timed out.",
      });
    }, 10000);

    client.on("error", (error) => {
      finish({
        ok: false,
        status: 0,
        reason: error.message,
      });
    });

    const request = client.request({
      [constants.HTTP2_HEADER_METHOD]: "POST",
      [constants.HTTP2_HEADER_PATH]: `/3/device/${args.token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": args.config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    request.setEncoding("utf8");

    request.on("response", (headers) => {
      const headerStatus = headers[constants.HTTP2_HEADER_STATUS];
      status =
        typeof headerStatus === "number"
          ? headerStatus
          : Number(headerStatus ?? 0);
    });

    request.on("data", (chunk) => {
      responseBody += chunk;
    });

    request.on("error", (error) => {
      finish({
        ok: false,
        status,
        reason: error.message,
      });
    });

    request.on("end", () => {
      if (status >= 200 && status < 300) {
        finish({ ok: true, status });
        return;
      }

      let reason = responseBody || `APNs returned HTTP ${status}.`;

      try {
        const parsed = JSON.parse(responseBody) as { reason?: string };
        reason = parsed.reason ?? reason;
      } catch {
        // Keep raw APNs response body.
      }

      finish({
        ok: false,
        status,
        reason,
      });
    });

    request.end(payload);
  });
}

async function disablePushToken(tokenId: string, reason: string) {
  const supabase = getPushServiceClient();

  if (!supabase) {
    return;
  }

  const { error } = await (supabase
    .from("user_push_device_tokens") as any)
    .update({
      enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenId);

  if (error) {
    console.error("Unable to disable failed Loombus push token:", reason, error.message);
  }
}

export async function sendNativePushForNotification(payload: NotificationPayload) {
  if (!shouldSendNativePush(payload)) {
    return;
  }

  const config = getApnsConfig();

  if (!config) {
    return;
  }

  const supabase = getPushServiceClient();

  if (!supabase) {
    return;
  }

  const { data: tokens, error } = await supabase
    .from("user_push_device_tokens")
    .select("id, token")
    .eq("user_id", payload.user_id)
    .eq("enabled", true)
    .eq("platform", "ios")
    .eq("token_type", "apns");

  if (error) {
    console.error("Unable to load Loombus push tokens:", error.message);
    return;
  }

  const tokenRows = (tokens ?? []) as PushTokenRow[];

  if (tokenRows.length === 0) {
    return;
  }

  const title = getPushTitle(payload);
  const body = cleanPushBody(payload.message) || "You have a new Loombus notification.";
  const url = getNotificationUrl(payload);

  await Promise.allSettled(
    tokenRows.map(async (tokenRow) => {
      const result = await sendApnsNotification({
        config,
        token: tokenRow.token,
        title,
        body,
        url,
      });

      if (!result.ok) {
        console.error("Loombus APNs delivery failed:", {
          status: result.status,
          reason: result.reason,
        });

        if (
          result.reason === "BadDeviceToken" ||
          result.reason === "DeviceTokenNotForTopic" ||
          result.reason === "Unregistered"
        ) {
          await disablePushToken(tokenRow.id, result.reason);
        }
      }
    })
  );
}
