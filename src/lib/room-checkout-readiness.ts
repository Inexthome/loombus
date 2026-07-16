import "server-only";

import { createRoomServiceSupabase } from "@/lib/room-operations";

export type RoomCheckoutStorageIssue =
  | "ready"
  | "service_role_missing"
  | "migration_missing"
  | "schema_outdated"
  | "permission_denied"
  | "storage_unavailable";

export type RoomCheckoutStorageReadiness = {
  ready: boolean;
  checkoutIntentsReady: boolean;
  roomBillingColumnsReady: boolean;
  issue: RoomCheckoutStorageIssue;
};

type StorageError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function classifyStorageError(error: StorageError | null): RoomCheckoutStorageIssue {
  if (!error) return "ready";

  const code = String(error.code ?? "").toUpperCase();
  const message = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("room_checkout_intents") && message.includes("not find") ||
    message.includes("relation") && message.includes("does not exist")
  ) {
    return "migration_missing";
  }

  if (
    code === "PGRST204" ||
    code === "42703" ||
    message.includes("column") &&
      (message.includes("does not exist") || message.includes("schema cache"))
  ) {
    return "schema_outdated";
  }

  if (code === "42501" || message.includes("permission denied")) {
    return "permission_denied";
  }

  return "storage_unavailable";
}

function logStorageError(label: string, error: StorageError | null) {
  if (!error) return;

  console.error(`Room checkout ${label} readiness failed:`, {
    code: error.code ?? "unknown",
    message: error.message ?? "unknown",
    details: error.details ?? null,
    hint: error.hint ?? null,
  });
}

export async function getRoomCheckoutStorageReadiness(): Promise<RoomCheckoutStorageReadiness> {
  let serviceSupabase;

  try {
    serviceSupabase = createRoomServiceSupabase();
  } catch {
    return {
      ready: false,
      checkoutIntentsReady: false,
      roomBillingColumnsReady: false,
      issue: "service_role_missing",
    };
  }

  const [intentResult, roomResult] = await Promise.all([
    serviceSupabase
      .from("room_checkout_intents")
      .select(
        "id, user_id, room_name, room_description, room_type, template_key, plan_key, member_limit, stripe_checkout_session_id, status, last_error, created_at, updated_at"
      )
      .limit(1),
    serviceSupabase
      .from("rooms")
      .select(
        "id, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_checkout_session_id, stripe_current_period_end, billing_updated_at"
      )
      .limit(1),
  ]);

  const intentError = (intentResult.error ?? null) as StorageError | null;
  const roomError = (roomResult.error ?? null) as StorageError | null;
  const checkoutIntentsReady = !intentError;
  const roomBillingColumnsReady = !roomError;

  logStorageError("intent table", intentError);
  logStorageError("Room billing columns", roomError);

  const issue = !checkoutIntentsReady
    ? classifyStorageError(intentError)
    : !roomBillingColumnsReady
      ? classifyStorageError(roomError)
      : "ready";

  return {
    ready: checkoutIntentsReady && roomBillingColumnsReady,
    checkoutIntentsReady,
    roomBillingColumnsReady,
    issue,
  };
}

export function getRoomCheckoutStorageMessage(issue: RoomCheckoutStorageIssue) {
  if (issue === "service_role_missing") {
    return "Room checkout storage cannot be verified because the Supabase service role is not configured.";
  }

  if (issue === "migration_missing") {
    return "Room checkout storage is not active. Apply the latest Room billing migration in Supabase, then retry.";
  }

  if (issue === "schema_outdated") {
    return "Room checkout storage is out of date. Apply the latest Room billing repair migration and reload the Supabase schema cache.";
  }

  if (issue === "permission_denied") {
    return "Room checkout storage permissions are incomplete. Apply the latest Room billing repair migration in Supabase.";
  }

  return "Room checkout storage is temporarily unavailable. Verify the Room billing migration in Supabase and retry.";
}
