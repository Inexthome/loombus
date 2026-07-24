import "server-only";

import { createClient } from "@supabase/supabase-js";

type ServiceClient = ReturnType<typeof createClient>;

type RoomDigestPreference = {
  room_id: string;
  user_id: string;
  email_digest_enabled: boolean;
  email_digest_frequency: "daily" | "weekly";
  email_digest_last_sent_at: string | null;
  email_digest_unsubscribe_token: string | null;
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

type ActivityRow = {
  activity_type: string;
  target_type: string;
  target_id: string;
  title: string;
  created_at: string;
};

type NotificationRow = {
  id: string;
  type: string;
  target_type: string;
  target_id: string | null;
  room_id?: string | null;
  message: string;
  created_at: string;
};

type DigestItem = {
  key: string;
  type: string;
  targetType: string;
  targetId: string | null;
  message: string;
  createdAt: string;
};

export type RoomDigestResult = {
  userId: string;
  roomId: string;
  email?: string;
  sent: boolean;
  skippedReason?: string;
  notificationCount?: number;
};

type DatabaseError = {
  code?: string | null;
  message?: string | null;
};

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

function isDue(preference: RoomDigestPreference) {
  if (!preference.email_digest_last_sent_at) return true;
  const lastSent = new Date(preference.email_digest_last_sent_at).getTime();
  return !Number.isFinite(lastSent) ||
    Date.now() - lastSent >= getWindowMs(preference.email_digest_frequency);
}

function getDigestSince(preference: RoomDigestPreference) {
  const fallback = Date.now() - getWindowMs(preference.email_digest_frequency);
  const lastSent = preference.email_digest_last_sent_at
    ? new Date(preference.email_digest_last_sent_at).getTime()
    : Number.NaN;
  return new Date(
    Number.isFinite(lastSent) ? Math.max(lastSent, fallback) : fallback
  ).toISOString();
}

function isMissingRoomDigestSchema(error: DatabaseError | null) {
  if (!error) return false;
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code ?? "");
}

function normalizedRoomType(value: string | null) {
  return (value ?? "").trim().toLowerCase().replaceAll(" ", "_");
}

function isCustomerSupportRoom(room: RoomRow) {
  return ["customer_support", "customer-support"].includes(
    normalizedRoomType(room.room_type)
  );
}

function activeMembership(row: MembershipRow | null) {
  if (!row) return false;
  const status = (row.status ?? "active").trim().toLowerCase();
  if (["blocked", "removed", "inactive", "suspended"].includes(status)) {
    return false;
  }
  if (!row.suspended_until) return true;
  const suspendedUntil = new Date(row.suspended_until).getTime();
  return Number.isFinite(suspendedUntil) && suspendedUntil <= Date.now();
}

function activityMessage(activity: ActivityRow, room: RoomRow) {
  if (isCustomerSupportRoom(room)) {
    if (activity.activity_type === "room_announcement") {
      return "A new Customer Support Room announcement is available.";
    }
    if (activity.activity_type === "room_event") {
      return "A new Customer Support Room event is available.";
    }
    return "New private activity is available in this Customer Support Room.";
  }

  if (activity.activity_type === "room_discussion") {
    return `New discussion: ${activity.title}`;
  }
  if (activity.activity_type === "room_announcement") {
    return `New announcement: ${activity.title}`;
  }
  return `New event: ${activity.title}`;
}

function notificationMessage(notification: NotificationRow, room: RoomRow) {
  if (!isCustomerSupportRoom(room)) return notification.message;
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

function itemUrl(siteUrl: string, roomId: string, item: DigestItem) {
  if (item.targetType === "room_moderation_item") {
    return `${siteUrl}/rooms/${roomId}/moderation`;
  }
  return `${siteUrl}/rooms/${roomId}`;
}

function buildRoomDigestEmail(args: {
  siteUrl: string;
  room: RoomRow;
  preference: RoomDigestPreference;
  items: DigestItem[];
}) {
  const roomName = args.room.name?.trim() || "Loombus Room";
  const label =
    args.preference.email_digest_frequency === "daily" ? "daily" : "weekly";
  const roomUrl = `${args.siteUrl}/rooms/${args.room.id}`;
  const settingsUrl = `${roomUrl}/notifications`;
  const unsubscribeUrl = `${args.siteUrl}/unsubscribe?token=${encodeURIComponent(
    args.preference.email_digest_unsubscribe_token ?? ""
  )}`;

  const rows = args.items
    .map((item) => {
      const date = new Date(item.createdAt).toLocaleString();
      const url = itemUrl(args.siteUrl, args.room.id, item);
      return `<li style="margin-bottom:14px;">
        <div><strong>${escapeHtml(item.message)}</strong></div>
        <div style="color:#71717a;font-size:13px;">${escapeHtml(date)}</div>
        <a href="${escapeHtml(url)}">Open Room</a>
      </li>`;
    })
    .join("");

  const text = [
    `${roomName}: ${label} Room digest`,
    "",
    ...args.items.map((item) => {
      const date = new Date(item.createdAt).toLocaleString();
      return `- ${item.message} (${date}) ${itemUrl(
        args.siteUrl,
        args.room.id,
        item
      )}`;
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
    <p>Here is recent activity from this Room.</p>
    <ul style="padding-left:20px;">${rows}</ul>
    <p style="margin-top:24px;">
      <a href="${escapeHtml(roomUrl)}">Open Room</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(settingsUrl)}">Manage Room digest</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a>
    </p>
    <p style="font-size:12px;color:#71717a;">
      Room digests contain summaries and links only. Discussion bodies, reply text, moderation evidence, and internal case notes are not included.
    </p>
  </body>
</html>`;

  return {
    subject: `${roomName}: ${label} Room digest`,
    html,
    text,
  };
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

function combineItems(
  activities: ActivityRow[],
  notifications: NotificationRow[],
  room: RoomRow
) {
  const activityItems: DigestItem[] = activities.map((activity) => ({
    key: `activity:${activity.target_type}:${activity.target_id}`,
    type: activity.activity_type,
    targetType: activity.target_type,
    targetId: activity.target_id,
    message: activityMessage(activity, room),
    createdAt: activity.created_at,
  }));

  const directItems: DigestItem[] = notifications
    .filter(
      (notification) =>
        !["room_discussion", "room_announcement", "room_event"].includes(
          notification.type
        )
    )
    .map((notification) => ({
      key: `notification:${notification.id}`,
      type: notification.type,
      targetType: notification.target_type,
      targetId: notification.target_id,
      message: notificationMessage(notification, room),
      createdAt: notification.created_at,
    }));

  const unique = new Map<string, DigestItem>();
  for (const item of [...activityItems, ...directItems]) unique.set(item.key, item);
  return [...unique.values()]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )
    .slice(0, 25);
}

export async function runRoomDigests(args: {
  supabase: ServiceClient;
  siteUrl: string;
  resendApiKey: string;
  digestFromEmail: string;
}): Promise<RoomDigestResult[]> {
  const { data: preferenceData, error: preferenceError } = await args.supabase
    .from("room_notification_preferences")
    .select(
      "room_id, user_id, email_digest_enabled, email_digest_frequency, email_digest_last_sent_at, email_digest_unsubscribe_token"
    )
    .eq("email_digest_enabled", true)
    .in("email_digest_frequency", ["daily", "weekly"]);

  if (preferenceError) {
    if (isMissingRoomDigestSchema(preferenceError)) return [];
    throw new Error(preferenceError.message || "Unable to load Room digest preferences.");
  }

  const duePreferences = ((preferenceData ?? []) as RoomDigestPreference[]).filter(
    isDue
  );
  const results: RoomDigestResult[] = [];

  for (const preference of duePreferences) {
    const { data: roomData, error: roomError } = await args.supabase
      .from("rooms")
      .select("id, name, room_type, status, owner_id, created_by")
      .eq("id", preference.room_id)
      .maybeSingle();
    const room = (roomData ?? null) as RoomRow | null;

    if (
      roomError ||
      !room ||
      ["deleted", "deleting"].includes((room.status ?? "").toLowerCase())
    ) {
      results.push({
        userId: preference.user_id,
        roomId: preference.room_id,
        sent: false,
        skippedReason: "Room is unavailable.",
      });
      continue;
    }

    const isOwner =
      room.owner_id === preference.user_id ||
      room.created_by === preference.user_id;
    const { data: membershipData, error: membershipError } = isOwner
      ? { data: null, error: null }
      : await args.supabase
          .from("room_members")
          .select("status, suspended_until")
          .eq("room_id", preference.room_id)
          .eq("user_id", preference.user_id)
          .maybeSingle();

    if (
      membershipError ||
      (!isOwner && !activeMembership(membershipData as MembershipRow | null))
    ) {
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

    const since = getDigestSince(preference);
    const [activityResult, notificationResult] = await Promise.all([
      args.supabase
        .from("room_activity_log")
        .select("activity_type, target_type, target_id, title, created_at")
        .eq("room_id", preference.room_id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50),
      args.supabase
        .from("notifications")
        .select("*")
        .eq("user_id", preference.user_id)
        .eq("room_id", preference.room_id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (activityResult.error || notificationResult.error) {
      results.push({
        userId: preference.user_id,
        roomId: preference.room_id,
        email,
        sent: false,
        skippedReason:
          activityResult.error?.message ||
          notificationResult.error?.message ||
          "Room digest activity could not be loaded.",
      });
      continue;
    }

    const items = combineItems(
      (activityResult.data ?? []) as ActivityRow[],
      (notificationResult.data ?? []) as NotificationRow[],
      room
    );
    if (items.length === 0) {
      results.push({
        userId: preference.user_id,
        roomId: preference.room_id,
        email,
        sent: false,
        skippedReason: "No new Room activity.",
        notificationCount: 0,
      });
      continue;
    }

    const content = buildRoomDigestEmail({
      siteUrl: args.siteUrl,
      room,
      preference,
      items,
    });
    const sent = await sendEmailWithResend({
      apiKey: args.resendApiKey,
      from: args.digestFromEmail,
      to: email,
      ...content,
    });

    if (!sent.ok) {
      results.push({
        userId: preference.user_id,
        roomId: preference.room_id,
        email,
        sent: false,
        skippedReason: sent.error ?? "Unable to send Room digest.",
        notificationCount: items.length,
      });
      continue;
    }

    const { error: updateError } = await args.supabase
      .from("room_notification_preferences")
      .update({ email_digest_last_sent_at: new Date().toISOString() })
      .eq("room_id", preference.room_id)
      .eq("user_id", preference.user_id);

    results.push({
      userId: preference.user_id,
      roomId: preference.room_id,
      email,
      sent: true,
      skippedReason: updateError
        ? "Digest sent, but the delivery checkpoint could not be updated."
        : undefined,
      notificationCount: items.length,
    });
  }

  return results;
}
