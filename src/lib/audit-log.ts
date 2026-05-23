import { createClient } from "@supabase/supabase-js";

type JsonObject = Record<string, unknown>;

export type AuditLogEvent = {
  actor_id?: string | null;
  action: string;
  target_type: string;
  target_id?: string | null;
  metadata?: JsonObject | null;
};

let auditSupabaseClient: ReturnType<typeof createClient> | null = null;

function getAuditSupabaseClient() {
  if (auditSupabaseClient) {
    return auditSupabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  auditSupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return auditSupabaseClient;
}

export async function logAuditEvent(event: AuditLogEvent) {
  const supabase = getAuditSupabaseClient();

  if (!supabase) {
    console.error("Audit log skipped: SUPABASE_SERVICE_ROLE_KEY is not configured.");
    return;
  }

  const auditLogPayload = {
    actor_id: event.actor_id ?? null,
    action: event.action,
    target_type: event.target_type,
    target_id: event.target_id ?? null,
    metadata: event.metadata ?? null,
  };

  type AuditInsertResult = {
    error: { message: string } | null;
  };

  type AuditTable = {
    insert: (payload: typeof auditLogPayload) => PromiseLike<AuditInsertResult>;
  };

  const auditTable = supabase.from("audit_logs") as unknown as AuditTable;
  const { error } = await auditTable.insert(auditLogPayload);

  if (error) {
    console.error("Audit log insert failed:", error.message);
  }
}
