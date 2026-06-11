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
  message: string;
};

let notificationServiceClient: ReturnType<typeof createClient> | null = null;

function getNotificationServiceClient() {
  if (notificationServiceClient) {
    return notificationServiceClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

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

export async function createNotification(
  payload: NotificationPayload
): Promise<{ error: ServiceRoleError | null }> {
  const supabase = getNotificationServiceClient();

  if (!supabase) {
    return { error: missingServiceRoleError() };
  }

  const { error } = await (supabase.from("notifications") as any).insert({
    user_id: payload.user_id,
    actor_id: payload.actor_id ?? null,
    type: payload.type,
    target_type: payload.target_type,
    target_id: payload.target_id ?? null,
    message: payload.message,
  });

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
  if (payloads.length === 0) {
    return { error: null };
  }

  const supabase = getNotificationServiceClient();

  if (!supabase) {
    return { error: missingServiceRoleError() };
  }

  const rows = payloads.map((payload) => ({
    user_id: payload.user_id,
    actor_id: payload.actor_id ?? null,
    type: payload.type,
    target_type: payload.target_type,
    target_id: payload.target_id ?? null,
    message: payload.message,
  }));

  const { error } = await (supabase.from("notifications") as any).insert(rows);

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

  if (adminError) {
    return { error: adminError, notifiedAdminCount: 0 };
  }

  const adminPayloads = ((admins ?? []) as { id: string }[])
    .filter((admin) => Boolean(admin.id))
    .map((admin) => ({
      user_id: admin.id,
      actor_id: payload.actor_id ?? null,
      type: payload.type,
      target_type: payload.target_type,
      target_id: payload.target_id ?? null,
      message: payload.message,
    }));

  const { error } = await createNotifications(adminPayloads);

  return {
    error,
    notifiedAdminCount: error ? 0 : adminPayloads.length,
  };
}
