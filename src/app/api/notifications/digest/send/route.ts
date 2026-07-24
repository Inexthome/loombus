import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  runRoomDigests,
  type RoomDigestResult,
} from "@/lib/room-digest-delivery";

type NotificationPreference = {
  user_id: string;
  email_digest_enabled: boolean;
  email_digest_frequency: "daily" | "weekly";
  email_digest_last_sent_at: string | null;
  email_digest_unsubscribe_token: string | null;
};

type EntitlementRow = {
  user_id: string;
  tier: string | null;
  ai_assisted_enabled: boolean | null;
};

type NotificationRow = {
  id: string;
  actor_id: string | null;
  type: string;
  target_type: string;
  target_id: string | null;
  room_id?: string | null;
  message: string;
  created_at: string;
};

type DigestResult = {
  userId: string;
  email?: string;
  sent: boolean;
  skippedReason?: string;
  notificationCount?: number;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getWindowMs(frequency: "daily" | "weekly") {
  return frequency === "daily"
    ? 24 * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000;
}

function getDigestSince(preference: NotificationPreference) {
  const fallback =
    Date.now() - getWindowMs(preference.email_digest_frequency);
  const lastSent = preference.email_digest_last_sent_at
    ? new Date(preference.email_digest_last_sent_at).getTime()
    : Number.NaN;
  return new Date(
    Number.isFinite(lastSent) ? Math.max(lastSent, fallback) : fallback
  ).toISOString();
}

function hasPremiumDigestAccess(entitlement: EntitlementRow | null) {
  return (
    entitlement?.ai_assisted_enabled === true &&
    ["premium", "admin"].includes(entitlement.tier ?? "")
  );
}

function isDue(preference: NotificationPreference) {
  if (!preference.email_digest_last_sent_at) return true;
  const lastSent = new Date(preference.email_digest_last_sent_at).getTime();
  return (
    !Number.isFinite(lastSent) ||
    Date.now() - lastSent >= getWindowMs(preference.email_digest_frequency)
  );
}

function getNotificationUrl(siteUrl: string, notification: NotificationRow) {
  if (notification.target_type === "discussion" && notification.target_id) {
    return `${siteUrl}/discussions/${notification.target_id}`;
  }
  if (notification.target_type === "conversation" && notification.target_id) {
    return `${siteUrl}/messages?conversation=${encodeURIComponent(
      notification.target_id
    )}`;
  }
  return `${siteUrl}/notifications`;
}

function buildDigestEmail(
  siteUrl: string,
  frequency: "daily" | "weekly",
  notifications: NotificationRow[],
  unsubscribeUrl: string
) {
  const label = frequency === "daily" ? "daily" : "weekly";
  const subject = `Your Loombus ${label} digest`;
  const rows = notifications
    .map((notification) => {
      const url = getNotificationUrl(siteUrl, notification);
      const date = new Date(notification.created_at).toLocaleString();
      return `<li style="margin-bottom:14px;">
        <div><strong>${escapeHtml(notification.message)}</strong></div>
        <div style="color:#71717a;font-size:13px;">${escapeHtml(date)}</div>
        <a href="${escapeHtml(url)}">Open in Loombus</a>
      </li>`;
    })
    .join("");

  const text = [
    `Your Loombus ${label} digest`,
    "",
    ...notifications.map((notification) => {
      const url = getNotificationUrl(siteUrl, notification);
      const date = new Date(notification.created_at).toLocaleString();
      return `- ${notification.message} (${date}) ${url}`;
    }),
    "",
    `Manage notification settings: ${siteUrl}/settings#notifications`,
    `Unsubscribe from account email digests: ${unsubscribeUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;line-height:1.5;color:#18181b;">
    <h1>Your Loombus ${escapeHtml(label)} digest</h1>
    <p>Here is recent non-Room activity connected to your account.</p>
    <ul style="padding-left:20px;">${rows}</ul>
    <p style="margin-top:24px;">
      <a href="${escapeHtml(siteUrl)}/settings#notifications">Manage notification settings</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from account email digests</a>
    </p>
    <p style="font-size:12px;color:#71717a;">
      This link only turns off the account digest. Room digest preferences and in-app notifications are not changed.
    </p>
  </body>
</html>`;

  return { subject, html, text };
}

async function sendEmailWithResend(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error:
        typeof body?.message === "string"
          ? body.message
          : `Resend returned HTTP ${response.status}.`,
    };
  }
  return { ok: true, error: null };
}

function getConfiguredCronSecret() {
  return process.env.CRON_SECRET ?? process.env.DIGEST_CRON_SECRET ?? "";
}

function getProvidedCronSecret(request: NextRequest) {
  const authorizationSecret =
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ?? "";
  return (
    authorizationSecret ||
    request.headers.get("x-digest-cron-secret")?.trim() ||
    ""
  );
}

async function runAccountDigests(args: {
  supabase: ReturnType<typeof createClient>;
  siteUrl: string;
  resendApiKey: string;
  digestFromEmail: string;
}) {
  const { data: preferences, error: preferencesError } = await args.supabase
    .from("notification_preferences")
    .select(
      "user_id, email_digest_enabled, email_digest_frequency, email_digest_last_sent_at, email_digest_unsubscribe_token"
    )
    .eq("email_digest_enabled", true)
    .in("email_digest_frequency", ["daily", "weekly"]);
  if (preferencesError) throw new Error(preferencesError.message);

  const duePreferences = ((preferences ?? []) as NotificationPreference[]).filter(
    isDue
  );
  const dueUserIds = duePreferences.map((preference) => preference.user_id);
  const { data: entitlements, error: entitlementError } = dueUserIds.length
    ? await args.supabase
        .from("user_ai_entitlements")
        .select("user_id, tier, ai_assisted_enabled")
        .in("user_id", dueUserIds)
    : { data: [], error: null };
  if (entitlementError) throw new Error(entitlementError.message);

  const entitlementByUserId = new Map(
    ((entitlements ?? []) as EntitlementRow[]).map((entitlement) => [
      entitlement.user_id,
      entitlement,
    ])
  );
  const results: DigestResult[] = [];

  for (const preference of duePreferences) {
    if (
      !hasPremiumDigestAccess(
        entitlementByUserId.get(preference.user_id) ?? null
      )
    ) {
      results.push({
        userId: preference.user_id,
        sent: false,
        skippedReason: "Premium email digest access required.",
      });
      continue;
    }

    const { data: authUser, error: userError } =
      await args.supabase.auth.admin.getUserById(preference.user_id);
    const email = authUser.user?.email;
    if (userError || !email) {
      results.push({
        userId: preference.user_id,
        sent: false,
        skippedReason: "No deliverable email address.",
      });
      continue;
    }

    const { data: notifications, error: notificationsError } = await args.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", preference.user_id)
      .gte("created_at", getDigestSince(preference))
      .order("created_at", { ascending: false })
      .limit(100);

    if (notificationsError) {
      results.push({
        userId: preference.user_id,
        email,
        sent: false,
        skippedReason: notificationsError.message,
      });
      continue;
    }

    const notificationRows = ((notifications ?? []) as NotificationRow[])
      .filter((notification) => !notification.room_id)
      .slice(0, 25);
    if (notificationRows.length === 0) {
      results.push({
        userId: preference.user_id,
        email,
        sent: false,
        skippedReason: "No new non-Room notifications.",
        notificationCount: 0,
      });
      continue;
    }

    const unsubscribeUrl = `${args.siteUrl}/unsubscribe?token=${encodeURIComponent(
      preference.email_digest_unsubscribe_token ?? ""
    )}`;
    const content = buildDigestEmail(
      args.siteUrl,
      preference.email_digest_frequency,
      notificationRows,
      unsubscribeUrl
    );
    const sent = await sendEmailWithResend({
      apiKey: args.resendApiKey,
      from: args.digestFromEmail,
      to: email,
      ...content,
    });

    if (!sent.ok) {
      results.push({
        userId: preference.user_id,
        email,
        sent: false,
        skippedReason: sent.error ?? "Unable to send account digest.",
        notificationCount: notificationRows.length,
      });
      continue;
    }

    const { error: updateError } = await (
      args.supabase.from("notification_preferences") as any
    )
      .update({ email_digest_last_sent_at: new Date().toISOString() })
      .eq("user_id", preference.user_id);

    results.push({
      userId: preference.user_id,
      email,
      sent: true,
      skippedReason: updateError
        ? "Digest sent, but the delivery checkpoint could not be updated."
        : undefined,
      notificationCount: notificationRows.length,
    });
  }

  return results;
}

async function runDigest(request: NextRequest) {
  const configuredSecret = getConfiguredCronSecret();
  const providedSecret = getProvidedCronSecret(request);
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return jsonError("Unauthorized.", 401);
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) return jsonError("Digest service is not configured.", 503);

  const resendApiKey = process.env.RESEND_API_KEY;
  const digestFromEmail = process.env.DIGEST_FROM_EMAIL;
  if (!resendApiKey || !digestFromEmail) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      skipped: true,
      reason: "Email provider is not configured.",
    });
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    new URL(request.url).origin;

  let accountResults: DigestResult[] = [];
  let roomResults: RoomDigestResult[] = [];
  let accountError: string | null = null;
  let roomError: string | null = null;

  try {
    accountResults = await runAccountDigests({
      supabase,
      siteUrl,
      resendApiKey,
      digestFromEmail,
    });
  } catch (error) {
    accountError =
      error instanceof Error
        ? error.message
        : "Account digest processing failed.";
  }

  try {
    roomResults = await runRoomDigests({
      supabase,
      siteUrl,
      resendApiKey,
      digestFromEmail,
    });
  } catch (error) {
    roomError =
      error instanceof Error ? error.message : "Room digest processing failed.";
  }

  const results = [...accountResults, ...roomResults];
  const failed = Boolean(accountError || roomError);
  return NextResponse.json(
    {
      ok: !failed,
      checked: results.length,
      sent: results.filter((result) => result.sent).length,
      accountDigests: {
        checked: accountResults.length,
        sent: accountResults.filter((result) => result.sent).length,
        error: accountError,
      },
      roomDigests: {
        checked: roomResults.length,
        sent: roomResults.filter((result) => result.sent).length,
        error: roomError,
      },
      results,
    },
    { status: failed ? 500 : 200 }
  );
}

export async function GET(request: NextRequest) {
  return runDigest(request);
}

export async function POST(request: NextRequest) {
  return runDigest(request);
}
