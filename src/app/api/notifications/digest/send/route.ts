import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type NotificationPreference = {
  user_id: string;
  email_digest_enabled: boolean;
  email_digest_frequency: "daily" | "weekly";
  email_digest_last_sent_at: string | null;
};

type NotificationRow = {
  id: string;
  actor_id: string | null;
  type: string;
  target_type: string;
  target_id: string | null;
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

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

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
  const now = Date.now();
  const fallbackSince = now - getWindowMs(preference.email_digest_frequency);

  if (!preference.email_digest_last_sent_at) {
    return new Date(fallbackSince).toISOString();
  }

  const lastSentTime = new Date(preference.email_digest_last_sent_at).getTime();

  if (!Number.isFinite(lastSentTime)) {
    return new Date(fallbackSince).toISOString();
  }

  return new Date(Math.max(lastSentTime, fallbackSince)).toISOString();
}

function isDue(preference: NotificationPreference) {
  if (!preference.email_digest_last_sent_at) {
    return true;
  }

  const lastSentTime = new Date(preference.email_digest_last_sent_at).getTime();

  if (!Number.isFinite(lastSentTime)) {
    return true;
  }

  return Date.now() - lastSentTime >= getWindowMs(preference.email_digest_frequency);
}

function getNotificationUrl(siteUrl: string, notification: NotificationRow) {
  if (notification.target_type === "discussion" && notification.target_id) {
    return `${siteUrl}/discussions/${notification.target_id}`;
  }

  return `${siteUrl}/notifications`;
}

function buildDigestEmail(
  siteUrl: string,
  frequency: "daily" | "weekly",
  notifications: NotificationRow[]
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
    `Manage notification settings: ${siteUrl}/profile`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;line-height:1.5;color:#18181b;">
    <h1>Your Loombus ${escapeHtml(label)} digest</h1>
    <p>Here is recent activity connected to your account.</p>
    <ul style="padding-left:20px;">${rows}</ul>
    <p style="margin-top:24px;">
      <a href="${escapeHtml(siteUrl)}/profile">Manage notification settings</a>
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

async function runDigest(request: NextRequest) {
  const configuredSecret = process.env.DIGEST_CRON_SECRET;
  const providedSecret =
    request.headers.get("x-digest-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return jsonError("Unauthorized.", 401);
  }

  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return jsonError("Digest service is not configured.", 503);
  }

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

  const { data: preferences, error: preferencesError } = await supabase
    .from("notification_preferences")
    .select("user_id, email_digest_enabled, email_digest_frequency, email_digest_last_sent_at")
    .eq("email_digest_enabled", true)
    .in("email_digest_frequency", ["daily", "weekly"]);

  if (preferencesError) {
    return jsonError(preferencesError.message || "Unable to load digest preferences.", 500);
  }

  const duePreferences = ((preferences ?? []) as NotificationPreference[]).filter(isDue);
  const results: DigestResult[] = [];

  for (const preference of duePreferences) {
    const { data: authUser, error: userError } =
      await supabase.auth.admin.getUserById(preference.user_id);

    const email = authUser.user?.email;

    if (userError || !email) {
      results.push({
        userId: preference.user_id,
        sent: false,
        skippedReason: "No deliverable email address.",
      });
      continue;
    }

    const since = getDigestSince(preference);

    const { data: notifications, error: notificationsError } = await supabase
      .from("notifications")
      .select("id, actor_id, type, target_type, target_id, message, created_at")
      .eq("user_id", preference.user_id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(25);

    if (notificationsError) {
      results.push({
        userId: preference.user_id,
        email,
        sent: false,
        skippedReason: notificationsError.message,
      });
      continue;
    }

    const notificationRows = (notifications ?? []) as NotificationRow[];

    if (notificationRows.length === 0) {
      results.push({
        userId: preference.user_id,
        email,
        sent: false,
        skippedReason: "No new notifications.",
        notificationCount: 0,
      });
      continue;
    }

    const emailContent = buildDigestEmail(
      siteUrl,
      preference.email_digest_frequency,
      notificationRows
    );

    const sendResult = await sendEmailWithResend({
      apiKey: resendApiKey,
      from: digestFromEmail,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!sendResult.ok) {
      results.push({
        userId: preference.user_id,
        email,
        sent: false,
        skippedReason: sendResult.error ?? "Unable to send email.",
        notificationCount: notificationRows.length,
      });
      continue;
    }

    await supabase
      .from("notification_preferences")
      .update({ email_digest_last_sent_at: new Date().toISOString() })
      .eq("user_id", preference.user_id);

    results.push({
      userId: preference.user_id,
      email,
      sent: true,
      notificationCount: notificationRows.length,
    });
  }

  return NextResponse.json({
    ok: true,
    checked: duePreferences.length,
    sent: results.filter((result) => result.sent).length,
    results,
  });
}


export async function GET(request: NextRequest) {
  return runDigest(request);
}

export async function POST(request: NextRequest) {
  return runDigest(request);
}
