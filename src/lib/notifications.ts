import { createClient } from "@supabase/supabase-js";
import { sendNativePushForNotification } from "@/lib/push-delivery";

type ServiceRoleError = {
  message: string;
};

export type NotificationPayload = {
  user_id: string;
  actor_id?: string | null;
  type: string;
  target_type: string;
  target_id?: string | null;
  room_id?: string | null;
  message: string;
};

let notificationServiceClient: ReturnType<typeof createClient> | null = null;

function getNotificationServiceClient() {
  if (notificationServiceClient) return notificationServiceClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  notificationServiceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return notificationServiceClient;
}

function missingServiceRoleError(): ServiceRoleError {
  return {
    message: "SUPABASE_SERVICE_ROLE_KEY is not configured for notification writes.",
  };
}

function notificationRow(payload: NotificationPayload) {
  const row: Record<string, unknown> = {
    user_id: payload.user_id,
    actor_id: payload.actor_id ?? null,
    type: payload.type,
    target_type: payload.target_type,
    target_id: payload.target_id ?? null,
    message: payload.message,
  };

  // Keep existing notification writes compatible while the Room migration is
  // applied after deployment. Room attribution is normally populated by the
  // database trigger from target_type and target_id.
  if (payload.room_id) row.room_id = payload.room_id;
  return row;
}

export async function createNotification(
  payload: NotificationPayload
): Promise<{ error: ServiceRoleError | null }> {
  const supabase = getNotificationServiceClient();
  if (!supabase) return { error: missingServiceRoleError() };

  const { error } = await (supabase.from("notifications") as any).insert(
    notificationRow(payload)
  );

  if (!error) {
    await sendNativePushForNotification(payload).catch((pushError) => {
      console.error("Native push delivery failed after notification insert:", pushError);
    });
  }

  return { error };
}

export async function createNotifications(
  payloads: NotificationPayload[]
): Promise<{ error: ServiceRoleError | null }> {
  if (payloads.length === 0) return { error: null };

  const supabase = getNotificationServiceClient();
  if (!supabase) return { error: missingServiceRoleError() };

  const { error } = await (supabase.from("notifications") as any).insert(
    payloads.map(notificationRow)
  );

  if (!error) {
    await Promise.allSettled(
      payloads.map((payload) => sendNativePushForNotification(payload))
    );
  }

  return { error };
}

export async function createAdminNotifications(
  payload: Omit<NotificationPayload, "user_id">
): Promise<{ error: ServiceRoleError | null; notifiedAdminCount: number }> {
  const supabase = getNotificationServiceClient();
  if (!supabase) {
    return { error: missingServiceRoleError(), notifiedAdminCount: 0 };
  }

  const { data: admins, error: adminError } = await (supabase
    .from("profiles") as any)
    .select("id")
    .eq("is_admin", true);
  if (adminError) return { error: adminError, notifiedAdminCount: 0 };

  const adminPayloads = ((admins ?? []) as { id: string }[])
    .filter((admin) => Boolean(admin.id))
    .map((admin) => ({
      user_id: admin.id,
      actor_id: payload.actor_id ?? null,
      type: payload.type,
      target_type: payload.target_type,
      target_id: payload.target_id ?? null,
      ...(payload.room_id ? { room_id: payload.room_id } : {}),
      message: payload.message,
    }));

  const { error } = await createNotifications(adminPayloads);
  return {
    error,
    notifiedAdminCount: error ? 0 : adminPayloads.length,
  };
}
