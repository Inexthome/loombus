import "server-only";

import { createSign } from "node:crypto";
import { connect, constants } from "node:http2";
import { createClient } from "@supabase/supabase-js";

type PushTokenRow = {
  id: string;
  user_id: string;
  token: string;
  platform: "ios" | "android";
  token_type: "apns" | "fcm";
};

type ApnsConfig = {
  teamId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
  host: string;
};

type FcmServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

type FcmConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
};

type DeliveryResult = {
  ok: boolean;
  status: number;
  reason?: string;
};

export type PushBroadcastSummary = {
  eligibleUsers: number;
  eligibleTokens: number;
  attemptedTokens: number;
  acceptedTokens: number;
  failedTokens: number;
  skippedTokens: number;
};

let serviceClient: ReturnType<typeof createClient> | null = null;
let cachedApnsJwt: { token: string; createdAtSeconds: number } | null = null;
let cachedFcmAccessToken: { token: string; expiresAtMs: number } | null = null;

function getServiceClient() {
  if (serviceClient) return serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

function parseServiceAccount(value: string | undefined) {
  if (!value?.trim()) return null;
  try {
    return JSON.parse(value) as FcmServiceAccount;
  } catch {
    return null;
  }
}

function getFirebaseServiceAccount() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (encoded) {
    const parsed = parseServiceAccount(Buffer.from(encoded, "base64").toString("utf8"));
    if (parsed) return parsed;
  }
  return parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}

function getFcmConfig(): FcmConfig | null {
  const account = getFirebaseServiceAccount();
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() ?? account?.project_id?.trim() ?? "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() ?? account?.client_email?.trim() ?? "";
  const encodedKey = process.env.FIREBASE_PRIVATE_KEY_BASE64?.trim();
  const privateKey = encodedKey
    ? Buffer.from(encodedKey, "base64").toString("utf8")
    : (process.env.FIREBASE_PRIVATE_KEY ?? account?.private_key ?? "").replace(/\\n/g, "\n").trim();
  const tokenUri = process.env.FIREBASE_TOKEN_URI?.trim() ?? account?.token_uri?.trim() ?? "https://oauth2.googleapis.com/token";

  if (!projectId || !clientEmail || !privateKey || !tokenUri) return null;
  return { projectId, clientEmail, privateKey, tokenUri };
}

function getApnsConfig(): ApnsConfig | null {
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const keyId = process.env.APNS_KEY_ID?.trim();
  const encodedKey = process.env.APNS_PRIVATE_KEY_BASE64?.trim();
  const privateKey = encodedKey
    ? Buffer.from(encodedKey, "base64").toString("utf8")
    : process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim() ?? "";
  const bundleId = process.env.APNS_BUNDLE_ID?.trim() || "com.loombus.mobile";
  const host = process.env.APNS_ENVIRONMENT?.trim() === "production"
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com";

  if (!teamId || !keyId || !privateKey || !bundleId) return null;
  return { teamId, keyId, privateKey, bundleId, host };
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createApnsJwt(config: ApnsConfig) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedApnsJwt && now - cachedApnsJwt.createdAtSeconds < 50 * 60) {
    return cachedApnsJwt.token;
  }

  const signingInput = `${base64UrlJson({ alg: "ES256", kid: config.keyId })}.${base64UrlJson({ iss: config.teamId, iat: now })}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({ key: config.privateKey, dsaEncoding: "ieee-p1363" });
  const token = `${signingInput}.${signature.toString("base64url")}`;
  cachedApnsJwt = { token, createdAtSeconds: now };
  return token;
}

async function getFcmAccessToken(config: FcmConfig) {
  const nowMs = Date.now();
  if (cachedFcmAccessToken && cachedFcmAccessToken.expiresAtMs - nowMs > 60_000) {
    return cachedFcmAccessToken.token;
  }

  const now = Math.floor(nowMs / 1000);
  const signingInput = `${base64UrlJson({ alg: "RS256", typ: "JWT" })}.${base64UrlJson({
    iss: config.clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: config.tokenUri,
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const assertion = `${signingInput}.${signer.sign(config.privateKey).toString("base64url")}`;

  const response = await fetch(config.tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  const payload = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; error?: string; error_description?: string }
    | null;

  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description ?? payload?.error ?? `OAuth token request failed with status ${response.status}.`);
  }

  cachedFcmAccessToken = {
    token: payload.access_token,
    expiresAtMs: nowMs + Math.max(60, payload.expires_in ?? 3600) * 1000,
  };
  return cachedFcmAccessToken.token;
}

async function sendApns(args: {
  config: ApnsConfig;
  token: string;
  title: string;
  body: string;
  url: string;
}): Promise<DeliveryResult> {
  const payload = JSON.stringify({
    aps: {
      alert: { title: args.title, body: args.body },
      sound: "default",
      "content-available": 1,
    },
    url: args.url,
    type: "qotw_announcement",
  });

  return new Promise((resolve) => {
    const client = connect(`https://${args.config.host}`);
    let status = 0;
    let responseBody = "";
    let settled = false;

    const finish = (result: DeliveryResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      client.close();
      resolve(result);
    };

    const timeout = setTimeout(() => finish({ ok: false, status: 0, reason: "APNs request timed out." }), 10_000);
    client.on("error", (error) => finish({ ok: false, status: 0, reason: error.message }));

    const request = client.request({
      [constants.HTTP2_HEADER_METHOD]: "POST",
      [constants.HTTP2_HEADER_PATH]: `/3/device/${args.token}`,
      authorization: `bearer ${createApnsJwt(args.config)}`,
      "apns-topic": args.config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    request.setEncoding("utf8");
    request.on("response", (headers) => {
      const value = headers[constants.HTTP2_HEADER_STATUS];
      status = typeof value === "number" ? value : Number(value ?? 0);
    });
    request.on("data", (chunk) => { responseBody += chunk; });
    request.on("error", (error) => finish({ ok: false, status, reason: error.message }));
    request.on("end", () => {
      if (status >= 200 && status < 300) return finish({ ok: true, status });
      let reason = responseBody || `APNs returned HTTP ${status}.`;
      try {
        reason = (JSON.parse(responseBody) as { reason?: string }).reason ?? reason;
      } catch {
        // Keep raw response.
      }
      finish({ ok: false, status, reason });
    });
    request.end(payload);
  });
}

async function sendFcm(args: {
  config: FcmConfig;
  token: string;
  title: string;
  body: string;
  url: string;
}): Promise<DeliveryResult> {
  try {
    const accessToken = await getFcmAccessToken(args.config);
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(args.config.projectId)}/messages:send`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: args.token,
            notification: { title: args.title, body: args.body },
            data: { url: args.url, type: "qotw_announcement" },
            android: { priority: "HIGH", notification: { sound: "default" } },
          },
        }),
      }
    );

    const text = await response.text();
    let reason: string | undefined;
    if (!response.ok) {
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string; status?: string } };
        reason = parsed.error?.status ?? parsed.error?.message ?? text;
      } catch {
        reason = text || `FCM request failed with status ${response.status}.`;
      }
    }
    return { ok: response.ok, status: response.status, reason };
  } catch (error) {
    return { ok: false, status: 0, reason: error instanceof Error ? error.message : "Unknown FCM delivery error." };
  }
}

async function disableToken(id: string, reason: string) {
  const supabase = getServiceClient();
  if (!supabase) return;
  const { error } = await (supabase.from("user_push_device_tokens") as any)
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("Unable to disable failed Loombus push token:", reason, error.message);
}

export async function getPushBroadcastAudience() {
  const supabase = getServiceClient();
  if (!supabase) throw new Error("Push broadcast service is not configured.");

  const rows: PushTokenRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await (supabase.from("user_push_device_tokens") as any)
      .select("id, user_id, token, platform, token_type")
      .eq("enabled", true)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as PushTokenRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  const validRows = rows.filter((row) =>
    Boolean(row.id && row.user_id && row.token) &&
    ((row.platform === "ios" && row.token_type === "apns") ||
      (row.platform === "android" && row.token_type === "fcm"))
  );

  return {
    tokens: validRows,
    eligibleUsers: new Set(validRows.map((row) => row.user_id)).size,
  };
}

export async function sendNativePushBroadcast(args: {
  title: string;
  body: string;
  url: string;
}): Promise<PushBroadcastSummary> {
  const title = args.title.replace(/\s+/g, " ").trim().slice(0, 80);
  const body = args.body.replace(/\s+/g, " ").trim().slice(0, 180);
  const url = args.url.trim();
  if (!title || !body || !url.startsWith("/")) throw new Error("Invalid push broadcast payload.");

  const apns = getApnsConfig();
  const fcm = getFcmConfig();
  if (!apns && !fcm) throw new Error("No native push provider is configured.");

  const audience = await getPushBroadcastAudience();
  let attemptedTokens = 0;
  let acceptedTokens = 0;
  let failedTokens = 0;
  let skippedTokens = 0;

  for (let index = 0; index < audience.tokens.length; index += 25) {
    const batch = audience.tokens.slice(index, index + 25);
    const results = await Promise.all(
      batch.map(async (row) => {
        if (row.platform === "ios") {
          if (!apns) return { row, result: null };
          return { row, result: await sendApns({ config: apns, token: row.token, title, body, url }) };
        }
        if (!fcm) return { row, result: null };
        return { row, result: await sendFcm({ config: fcm, token: row.token, title, body, url }) };
      })
    );

    for (const { row, result } of results) {
      if (!result) {
        skippedTokens += 1;
        continue;
      }
      attemptedTokens += 1;
      if (result.ok) {
        acceptedTokens += 1;
        continue;
      }

      failedTokens += 1;
      const invalidApns = row.platform === "ios" && ["BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered"].includes(result.reason ?? "");
      const invalidFcm = row.platform === "android" && (result.reason === "UNREGISTERED" || result.reason === "NOT_FOUND" || result.status === 404);
      if (invalidApns || invalidFcm) await disableToken(row.id, result.reason ?? "Push token rejected");
    }
  }

  return {
    eligibleUsers: audience.eligibleUsers,
    eligibleTokens: audience.tokens.length,
    attemptedTokens,
    acceptedTokens,
    failedTokens,
    skippedTokens,
  };
}
