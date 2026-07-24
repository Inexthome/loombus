import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type NotificationPreference = {
  user_id: string;
  email_digest_enabled: boolean;
  email_digest_frequency: "daily" | "weekly";
  email_digest_last_sent_at: string | null;
  email_digest_unsubscribe_token: string | null;
};

type RoomDigestPreference = {
  room_id: string;
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
  room_id: string | null;
  message: string;
  created_at: string;
};

type RoomRow = {
  id: string;
  name: string | null;
  room_type: string | null;
  status: string | null;
  owner_id: string | null;
  created_by: string | null;
};

type MembershipRow = {
  status: string | null;
  suspended_until: string | null;
};

type DigestResult = {
  userId: string;
  email?: string;
  sent: boolean;
  skippedReason?: string;
  notificationCount?: number;
  roomId?: string;
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

function getDigestSince(
  frequency: "daily" | "weekly",
  lastSentAt: string | null
) {
  const now = Date.now();
  const fallbackSince = now - getWindowMs(frequency);

  if (!lastSentAt) {
    return new Date(fallbackSince).toISOString();
  }

  const lastSentTime = new Date(lastSentAt).getTime();
  if (!Number.isFinite(lastSentTime)) {
    return new Date(fallbackSince).toISOString();
  }

  return new Date(Math.max(lastSentTime, fallbackSince)).toISOString();
}

function hasPremiumDigestAccess(entitlement: EntitlementRow | null) {
  return (
    entitlement?.ai_assisted_enabled === true &&
    ["premium", "admin"].includes(entitlement.tier ?? "")
  );
}

function isDue(
  frequency: "daily" | "weekly",
  lastSentAt: string | null
) {
  if (!lastSentAt) return true;
  const lastSentTime = new Date(lastSentAt).getTime();
  if (!Number.isFinite(lastSentTime)) return true;
  return Date.now() - lastSentTime >= getWindowMs(frequency);
}

function getNotificationUrl(siteUrl: string, notification: NotificationRow) {
  if (notification.room_id) {
    if (notification.target_type === "room_moderation_item") {
      return `${siteUrl}/rooms/${notification.room_id}/moderation`;
    }
    return `${siteUrl}/rooms/${notification.room_id}`;
  }

  if (notification.target_type === "discussion" && notification.target_id) {
    return `${siteUrl}/discussions/${notification.target_id}`;
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
    `Unsubscribe from email digests: ${unsubscribeUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;line-height:1.5;color:#18181b;">
    <h1>Your Loombus ${escapeHtml(label)} digest</h1>
    <p>Here is recent activity connected to your account.</p>
    <ul style="padding-left:20px;">${rows}</ul>
    <p style="margin-top:24px;">
      <a href="${escapeHtml(siteUrl)}/settings#notifications">Manage notification settings</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from email digests</a>
    </p>
    <p style="font-size:12px;color:#71717a;">
      This unsubscribe link only turns off Loombus account email digests. In-app notifications are not changed.
    </p>
  </body>
</html>`;

  return { subject, html, text };
}

function normalizedRoomType(value: string | null) {
  return (value ?? "").trim().toLowerCase().replaceAll(" ", "_");
}

function isCustomerSupportRoom(roomType: string | null) {
  return ["customer_support", "customer-support"].includes(
    normalizedRoomType(roomType)
  );
}

function roomDigestMessage(notification: NotificationRow, roomType: string | null) {
  if (!isCustomerSupportRoom(roomType)) return notification.message;

  if (notification.type === "room_support_case") {
    return "A new Customer Support case was created.";
  }
  if (notification.type === "room_reply") {
    return "A Customer Support case received a new reply.";
  }
  if (notification.type.startsWith("room_moderation_")) {
    return "A Room moderation case changed status.";
  }
  return "New private activity is available in this Customer Support Room.";
}

function buildRoomDigestEmail(
  siteUrl: string,
  room: RoomRow,
  preference: RoomDigestPreference,
  notifications: NotificationRow[]
) {
  const roomName = room.name?.trim() || "Loombus Room";
  const label = preference.email_digest_frequency === "daily" ? "daily" : "weekly";
  const roomUrl = `${siteUrl}/rooms/${room.id}`;
  const settingsUrl = `${roomUrl}/notifications`;
  const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${encodeURIComponent(
    preference.email_digest_unsubscribe_token ?? ""
  )}`;
  const subject = `${roomName}: ${label} Room digest`;

  const rows = notifications
    .map((notification) => {
      const message = roomDigestMessage(notification, room.room_type);
      const date = new Date(notification.created_at).toLocaleString();
      const url = getNotificationUrl(siteUrl, notification);
      return `<li style="margin-bottom:14px;">
        <div><strong>${escapeHtml(message)}</strong></div>
        <div style="color:#71717a;font-size:13px;">${escapeHtml(date)}</div>
        <a href="${escapeHtml(url)}">Open Room</a>
      </li>`;
    })
    .join("");

  const text = [
    `${roomName}: ${label} Room digest`,
    "",
    ...notifications.map((notification) => {
      const message = roomDigestMessage(notification, room.room_type);
      const date = new Date(notification.created_at).toLocaleString();
      return `- ${message} (${date}) ${getNotificationUrl(siteUrl, notification)}`;
    }),
    "",
    `Open Room: ${roomUrl}`,
    `Manage this Room digest: ${settingsUrl}`,
    `Unsubscribe from this Room digest: ${unsubscribeUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;line-height:1.5;color:#18181b;">
    <h1>${escapeHtml(roomName)} ${escapeHtml(label)} digest</h1>
    <p>Here is recent notification activity from this Room.</p>
    <ul style="padding-left:20px;">${rows}</ul>
    <p style="margin-top:24px;">
      <a href="${escapeHtml(roomUrl)}">Open Room</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(settingsUrl)}">Manage Room digest</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a>
    </p>
    <p style="font-size:12px;color:#71717a;">
      Room digests contain notification summaries and links only. Discussion bodies, reply text, moderation evidence, and internal case notes are not included.
    </p>
  </body>
</html>`;

  return { subject, html, text, unsubscribeUrl };
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
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";

  return authorizationSecret || request.headers.get("x-digest-cron-secret")?.trim() || "";
}

function activeMembership(row: MembershipRow | null) {
  if (!row) return false;
  const status = (row.status ?? "active").trim().toLowerCase();
  if (["blocked", "removed", "inactive", "suspended"].includes(status)) return false;
  if (!row.suspended_until) return true;
  const suspendedUntil = new Date(row.suspended_until).getTime();
  return Number.isFinite(suspendedUntil) && suspendedUntil <= Date.now();
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
    (preference) =>
      isDue(preference.email_digest_frequency, preference.email_digest_last_sent_at)
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
    if (!hasPremiumDigestAccess(entitlementByUserId.get(preference.user_id) ?? null)) {
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

    const since = getDigestSince(
      preference.email_digest_frequency,
      preference.email_digest_last_sent_at
    );
    const { data: notifications, error: notificationsError } = await args.supabase
      .from("notifications")
      .select("id, actor_id, type, target_type, target_id, room_id, message, created_at")
      .eq("user_id", preference.user_id)
      .is("room_id", null)
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
        skippedReason: "No new non-Room notifications.",
        notificationCount: 0,
      });
      continue;
    }

    const unsubscribeUrl = `${args.siteUrl}/unsubscribe?token=${encodeURIComponent(
      preference.email_digest_unsubscribe_token ?? ""
    )}`;
    const emailContent = buildDigestEmail(
      args.siteUrl,
      preference.email_digest_frequency,
      notificationRows,
      unsubscribeUrl
    );
    const sendResult = await sendEmailWithResend({
      apiKey: args.resendApiKey,
      from: args.digestFromEmail,
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

    await args.supabase
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

  return results;
}

async function runRoomDigests(args: {
  supabase: ReturnType<typeof createClient>;
  siteUrl: string;
  resendApiKey: string;
  digestFromEmail: string;
}) {
  const { data: preferences, error: preferencesError } = await args.supabase
    .from("room_notification_preferences")
    .select(
      "room_id, user_id, email_digest_enabled, email_digest_frequency, email_digest_last_sent_at, email_digest_unsubscribe_token"
    )
    .eq("email_digest_enabled", true)
    .in("email_digest_frequency", ["daily", "weekly"]);

  if (preferencesError) throw new Error(preferencesError.message);

  const duePreferences = ((preferences ?? []) as RoomDigestPreference[]).filter(
    (preference) =>
      isDue(preference.email_digest_frequency, preference.email_digest_last_sent_at)
  );
  const results: DigestResult[] = [];

  for (const preference of duePreferences) {
    const { data: roomData, error: roomError } = await args.supabase
      .from("rooms")
      .select("id, name, room_type, status, owner_id, created_by")
      .eq("id", preference.room_id)
      .maybeSingle();
    const room = (roomData ?? null) as RoomRow | null;

    if (roomError || !room || ["deleted", "deleting"].includes((room.status ?? "").toLowerCase())) {
      results.push({
        userId: preference.user_id,
        roomId: preference.room_id,
        sent: false,
        skippedReason: "Room is unavailable.",
      });
      continue;
    }

    const isOwner =
      room.owner_id === preference.user_id || room.created_by === preference.user_id;
    const { data: membershipData, error: membershipError } = isOwner
      ? { data: null, error: null }
      : await args.supabase
          .from("room_members")
          .select("status, suspended_until")
          .eq("room_id", preference.room_id)
          .eq("user_id", preference.user_id)
          .maybeSingle();

    if (membershipError || (!isOwner && !activeMembership(membershipData as MembershipRow | null))) {
      results.push({
        userId: preference.user_id,
        roomId: preference.room_id,
        sent: false,
        skippedReason: "Active Room membership is required.",
      });
      continue;
    }

    const { data: authUser, error: userError } =
      await args.supabase.auth.admin.getUserById(preference.user_id);
    const email = authUser.user?.email;
    if (userError || !email) {
      results.push({
        userId: preference.user_id,
        roomId: preference.room_id,
        sent: false,
        skippedReason: "No deliverable email address.",
      });
      continue;
    }

    const since = getDigestSince(
      preference.email_digest_frequency,
      preference.email_digest_last_sent_at
    );
    const { data: notifications, error: notificationsError } = await args.supabase
      .from("notifications")
      .select("id, actor_id, type, target_type, target_id, room_id, message, created_at")
      .eq("user_id", preference.user_id)
      .eq("room_id", preference.room_id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(25);

    if (notificationsError) {
      results.push({
        userId: preference.user_id,
        roomId: preference.room_id,
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
        roomId: preference.room_id,
        email,
        sent: false,
        skippedReason: "No new Room notifications.",
        notificationCount: 0,
      });
      continue;
    }

    const emailContent = buildRoomDigestEmail(
      args.siteUrl,
      room,
      preference,
      notificationRows
    );
    const sendResult = await sendEmailWithResend({
      apiKey: args.resendApiKey,
      from: args.digestFromEmail,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!sendResult.ok) {
      results.push({
        userId: preference.user_id,
        roomId: preference.room_id,
        email,
        sent: false,
        skippedReason: sendResult.error ?? "Unable to send Room digest.",
        notificationCount: notificationRows.length,
      });
      continue;
    }

    await args.supabase
      .from("room_notification_preferences")
      .update({ email_digest_last_sent_at: new Date().toISOString() })
      .eq("room_id", preference.room_id)
      .eq("user_id", preference.user_id);

    results.push({
      userId: preference.user_id,
      roomId: preference.room_id,
      email,
      sent: true,
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

  try {
    const [accountResults, roomResults] = await Promise.all([
      runAccountDigests({ supabase, siteUrl, resendApiKey, digestFromEmail }),
      runRoomDigests({ supabase, siteUrl, resendApiKey, digestFromEmail }),
    ]);
    const results = [...accountResults, ...roomResults];

    return NextResponse.json({
      ok: true,
      checked: results.length,
      sent: results.filter((result) => result.sent).length,
      accountDigests: {
        checked: accountResults.length,
        sent: accountResults.filter((result) => result.sent).length,
      },
      roomDigests: {
        checked: roomResults.length,
        sent: roomResults.filter((result) => result.sent).length,
      },
      results,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Digest processing failed.",
      500
    );
  }
}

export async function GET(request: NextRequest) {
  return runDigest(request);
}

export async function POST(request: NextRequest) {
  return runDigest(request);
}
