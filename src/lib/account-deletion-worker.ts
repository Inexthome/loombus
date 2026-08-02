import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 50;

type ClaimedRequest = {
  request_id: string;
  user_id: string;
  processing_attempts: number;
};

type RegistryRow = {
  resource_key: string;
  data_class: string;
  system_of_record: string;
  disposition:
    | "delete"
    | "anonymize"
    | "retain"
    | "staged_delete"
    | "vendor_delete"
    | "manual_review";
  handler_key: string;
  execution_mode: "automatic" | "manual_review" | "external";
  detail: Record<string, unknown> | null;
};

type ProcessResult = {
  requestId: string;
  status: string;
  attempts: number;
  exceptions: number;
  failed: number;
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Account deletion worker is not configured.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizedBatchSize(value?: number) {
  if (!Number.isFinite(value)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(Math.trunc(value as number), MAX_BATCH_SIZE));
}

async function verifyAccountRestriction(
  supabase: SupabaseClient,
  request: ClaimedRequest,
  resource: RegistryRow
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", request.user_id)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return {
      status: "failed" as const,
      exception_code: "profile_missing",
      detail: { message: "The profile required to enforce the deletion request is missing." },
    };
  }
  if (data.account_status !== "deletion_requested") {
    return {
      status: "failed" as const,
      exception_code: "account_not_restricted",
      detail: {
        message: "The account is not in the required deletion_requested state.",
        observed_account_status: data.account_status,
      },
    };
  }

  return {
    status: "completed" as const,
    exception_code: null,
    detail: {
      message: "Account restriction verified.",
      observed_account_status: data.account_status,
      registry: resource.detail ?? {},
    },
  };
}

async function dispositionFor(
  supabase: SupabaseClient,
  request: ClaimedRequest,
  resource: RegistryRow
) {
  if (
    resource.execution_mode === "automatic" &&
    resource.handler_key === "verify_account_restriction"
  ) {
    return verifyAccountRestriction(supabase, request, resource);
  }

  return {
    status: "excepted" as const,
    exception_code:
      resource.execution_mode === "external"
        ? "external_verification_required"
        : "manual_review_required",
    detail: {
      message:
        resource.execution_mode === "external"
          ? "Vendor or infrastructure verification is required before this resource can be completed."
          : "This resource is not approved for automatic deletion or anonymization.",
      execution_mode: resource.execution_mode,
      handler_key: resource.handler_key,
      registry: resource.detail ?? {},
    },
  };
}

async function markRequestFailed(
  supabase: SupabaseClient,
  request: ClaimedRequest,
  error: unknown
) {
  const message = error instanceof Error ? error.message : "Unknown processor failure.";
  const now = new Date().toISOString();

  await supabase
    .from("account_deletion_requests")
    .update({ status: "failed", last_error: message.slice(0, 2000) })
    .eq("id", request.request_id)
    .eq("status", "processing");

  await supabase.from("account_deletion_events").insert({
    request_id: request.request_id,
    user_id: request.user_id,
    actor_id: null,
    event_type: "processing_failed",
    from_status: "processing",
    to_status: "failed",
    detail: { message: message.slice(0, 2000), failed_at: now },
  });
}

async function processRequest(
  supabase: SupabaseClient,
  request: ClaimedRequest,
  registry: RegistryRow[]
): Promise<ProcessResult> {
  try {
    for (const resource of registry) {
      const result = await dispositionFor(supabase, request, resource);
      const { error } = await supabase.from("account_deletion_dispositions").upsert(
        {
          request_id: request.request_id,
          resource_key: resource.resource_key,
          data_class: resource.data_class,
          system_of_record: resource.system_of_record,
          disposition: resource.disposition,
          status: result.status,
          exception_code: result.exception_code,
          detail: result.detail,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "request_id,resource_key" }
      );
      if (error) throw error;
    }

    const { data, error } = await supabase.rpc("finalize_account_deletion_request", {
      p_request_id: request.request_id,
    });
    if (error) throw error;

    const result = (Array.isArray(data) ? data[0] : data) as
      | {
          status: string;
          exception_count: number;
          failed_count: number;
        }
      | null;
    if (!result) throw new Error("Processor finalization returned no result.");

    return {
      requestId: request.request_id,
      status: result.status,
      attempts: request.processing_attempts,
      exceptions: result.exception_count,
      failed: result.failed_count,
    };
  } catch (error) {
    await markRequestFailed(supabase, request, error);
    throw error;
  }
}

export async function runAccountDeletionWorker(options?: { batchSize?: number }) {
  const supabase = serviceClient();
  const batchSize = normalizedBatchSize(options?.batchSize);

  const { data: registryData, error: registryError } = await supabase
    .from("account_deletion_resource_registry")
    .select(
      "resource_key, data_class, system_of_record, disposition, handler_key, execution_mode, detail"
    )
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (registryError) throw registryError;

  const registry = (registryData ?? []) as RegistryRow[];
  if (registry.length === 0) {
    throw new Error("Account deletion resource registry is empty.");
  }

  const { data: claimedData, error: claimError } = await supabase.rpc(
    "claim_account_deletion_requests",
    { p_limit: batchSize }
  );
  if (claimError) throw claimError;

  const claimed = (claimedData ?? []) as ClaimedRequest[];
  const results: ProcessResult[] = [];
  const errors: Array<{ requestId: string; message: string }> = [];

  for (const request of claimed) {
    try {
      results.push(await processRequest(supabase, request, registry));
    } catch (error) {
      errors.push({
        requestId: request.request_id,
        message: error instanceof Error ? error.message : "Unknown processor failure.",
      });
    }
  }

  return {
    ok: errors.length === 0,
    claimed: claimed.length,
    processed: results.length,
    blocked: results.filter((result) => result.status === "blocked").length,
    completed: results.filter((result) => result.status === "completed").length,
    failed: errors.length + results.filter((result) => result.status === "failed").length,
    results,
    errors,
  };
}
