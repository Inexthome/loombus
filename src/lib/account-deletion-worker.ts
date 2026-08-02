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

type ExistingDisposition = {
  resource_key: string;
  status: "pending" | "in_progress" | "completed" | "excepted" | "failed" | "not_applicable";
  reviewed_at: string | null;
  verification_evidence: Record<string, unknown> | null;
  irreversible: boolean;
};

type DispositionResult = {
  status: "completed" | "excepted" | "failed";
  exception_code: string | null;
  detail: Record<string, unknown>;
  verification_evidence?: Record<string, unknown>;
  irreversible?: boolean;
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
): Promise<DispositionResult> {
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

function destructiveHandlersEnabled() {
  return process.env.ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED === "true";
}

async function deleteFirstPartyNotifications(
  supabase: SupabaseClient,
  request: ClaimedRequest,
  resource: RegistryRow
): Promise<DispositionResult> {
  if (!destructiveHandlersEnabled()) {
    return {
      status: "excepted",
      exception_code: "destructive_handlers_disabled",
      detail: {
        message: "The first-party notification deletion handler is deployed but not enabled.",
        handler_key: resource.handler_key,
      },
    };
  }

  const { data, error } = await supabase.rpc("delete_account_notification_data", {
    p_request_id: request.request_id,
  });
  if (error) throw error;

  const evidence = (data ?? {}) as Record<string, unknown>;
  return {
    status: "completed",
    exception_code: null,
    detail: {
      message: "First-party notification data deleted.",
      deleted_rows: evidence.deleted_rows ?? {},
    },
    verification_evidence: evidence,
    irreversible: true,
  };
}

async function deletePrivatePersonalizationData(
  supabase: SupabaseClient,
  request: ClaimedRequest,
  resource: RegistryRow
): Promise<DispositionResult> {
  if (!destructiveHandlersEnabled()) {
    return {
      status: "excepted",
      exception_code: "destructive_handlers_disabled",
      detail: {
        message: "The private personalization deletion handler is deployed but not enabled.",
        handler_key: resource.handler_key,
      },
    };
  }

  const { data, error } = await supabase.rpc("delete_account_private_personalization_data", {
    p_request_id: request.request_id,
  });
  if (error) throw error;

  const evidence = (data ?? {}) as Record<string, unknown>;
  return {
    status: "completed",
    exception_code: null,
    detail: {
      message: "Private personalization and relationship data deleted.",
      deleted_rows: evidence.deleted_rows ?? {},
    },
    verification_evidence: evidence,
    irreversible: true,
  };
}

async function deletePrivateActivityData(
  supabase: SupabaseClient,
  request: ClaimedRequest,
  resource: RegistryRow
): Promise<DispositionResult> {
  if (!destructiveHandlersEnabled()) {
    return {
      status: "excepted",
      exception_code: "destructive_handlers_disabled",
      detail: {
        message: "The private activity deletion handler is deployed but not enabled.",
        handler_key: resource.handler_key,
      },
    };
  }

  const { data, error } = await supabase.rpc("delete_account_private_activity_data", {
    p_request_id: request.request_id,
  });
  if (error) throw error;

  const evidence = (data ?? {}) as Record<string, unknown>;
  return {
    status: "completed",
    exception_code: null,
    detail: {
      message: "Private drafts and activity history deleted.",
      deleted_rows: evidence.deleted_rows ?? {},
    },
    verification_evidence: evidence,
    irreversible: true,
  };
}

async function deletePrivateGoalsData(
  supabase: SupabaseClient,
  request: ClaimedRequest,
  resource: RegistryRow
): Promise<DispositionResult> {
  if (!destructiveHandlersEnabled()) {
    return {
      status: "excepted",
      exception_code: "destructive_handlers_disabled",
      detail: {
        message: "The private goals deletion handler is deployed but not enabled.",
        handler_key: resource.handler_key,
      },
    };
  }

  const { data, error } = await supabase.rpc("delete_account_private_goals_data", {
    p_request_id: request.request_id,
  });
  if (error) throw error;

  const evidence = (data ?? {}) as Record<string, unknown>;
  return {
    status: "completed",
    exception_code: null,
    detail: {
      message: "Private goals, notes, and saved-folder metadata deleted.",
      deleted_rows: evidence.deleted_rows ?? {},
    },
    verification_evidence: evidence,
    irreversible: true,
  };
}

async function deleteMatchingPreferencesData(
  supabase: SupabaseClient,
  request: ClaimedRequest,
  resource: RegistryRow
): Promise<DispositionResult> {
  if (!destructiveHandlersEnabled()) {
    return {
      status: "excepted",
      exception_code: "destructive_handlers_disabled",
      detail: {
        message: "The private matching-preferences deletion handler is deployed but not enabled.",
        handler_key: resource.handler_key,
      },
    };
  }

  const { data, error } = await supabase.rpc("delete_account_matching_preferences_data", {
    p_request_id: request.request_id,
  });
  if (error) throw error;

  const evidence = (data ?? {}) as Record<string, unknown>;
  return {
    status: "completed",
    exception_code: null,
    detail: {
      message: "Private matching preferences and rules deleted.",
      deleted_rows: evidence.deleted_rows ?? {},
    },
    verification_evidence: evidence,
    irreversible: true,
  };
}

async function deleteFloorCloudData(
  supabase: SupabaseClient,
  request: ClaimedRequest,
  resource: RegistryRow
): Promise<DispositionResult> {
  if (!destructiveHandlersEnabled()) {
    return {
      status: "excepted",
      exception_code: "destructive_handlers_disabled",
      detail: {
        message: "The private Floor cloud deletion handler is deployed but not enabled.",
        handler_key: resource.handler_key,
      },
    };
  }

  const { data, error } = await supabase.rpc("delete_account_floor_cloud_data", {
    p_request_id: request.request_id,
  });
  if (error) throw error;

  const evidence = (data ?? {}) as Record<string, unknown>;
  return {
    status: "completed",
    exception_code: null,
    detail: {
      message: "Member-private Floor cloud state deleted.",
      deleted_rows: evidence.deleted_rows ?? {},
    },
    verification_evidence: evidence,
    irreversible: true,
  };
}

async function deleteDiscussionAudiencePreferencesData(
  supabase: SupabaseClient,
  request: ClaimedRequest,
  resource: RegistryRow
): Promise<DispositionResult> {
  if (!destructiveHandlersEnabled()) {
    return {
      status: "excepted",
      exception_code: "destructive_handlers_disabled",
      detail: {
        message: "The Discussion audience preferences deletion handler is deployed but not enabled.",
        handler_key: resource.handler_key,
      },
    };
  }

  const { data, error } = await supabase.rpc(
    "delete_account_discussion_audience_preferences_data",
    { p_request_id: request.request_id }
  );
  if (error) throw error;

  const evidence = (data ?? {}) as Record<string, unknown>;
  return {
    status: "completed",
    exception_code: null,
    detail: {
      message: "Member-private Discussion audience defaults deleted.",
      deleted_rows: evidence.deleted_rows ?? {},
    },
    verification_evidence: evidence,
    irreversible: true,
  };
}

async function deleteProductFeedbackData(
  supabase: SupabaseClient,
  request: ClaimedRequest,
  resource: RegistryRow
): Promise<DispositionResult> {
  if (!destructiveHandlersEnabled()) {
    return {
      status: "excepted",
      exception_code: "destructive_handlers_disabled",
      detail: {
        message: "The product-feedback deletion handler is deployed but not enabled.",
        handler_key: resource.handler_key,
      },
    };
  }

  const { data, error } = await supabase.rpc("delete_account_product_feedback_data", {
    p_request_id: request.request_id,
  });
  if (error) throw error;

  const evidence = (data ?? {}) as Record<string, unknown>;
  return {
    status: "completed",
    exception_code: null,
    detail: {
      message: "Member-submitted product feedback metadata deleted.",
      deleted_rows: evidence.deleted_rows ?? {},
    },
    verification_evidence: evidence,
    irreversible: true,
  };
}

async function deleteCommerceSavesData(
  supabase: SupabaseClient,
  request: ClaimedRequest,
  resource: RegistryRow
): Promise<DispositionResult> {
  if (!destructiveHandlersEnabled()) {
    return {
      status: "excepted",
      exception_code: "destructive_handlers_disabled",
      detail: {
        message: "The private commerce-saves deletion handler is deployed but not enabled.",
        handler_key: resource.handler_key,
      },
    };
  }

  const { data, error } = await supabase.rpc("delete_account_commerce_saves_data", {
    p_request_id: request.request_id,
  });
  if (error) throw error;

  const evidence = (data ?? {}) as Record<string, unknown>;
  return {
    status: "completed",
    exception_code: null,
    detail: {
      message: "Member-private marketplace and local saved-item metadata deleted.",
      deleted_rows: evidence.deleted_rows ?? {},
    },
    verification_evidence: evidence,
    irreversible: true,
  };
}

async function dispositionFor(
  supabase: SupabaseClient,
  request: ClaimedRequest,
  resource: RegistryRow
): Promise<DispositionResult> {
  if (
    resource.execution_mode === "automatic" &&
    resource.handler_key === "verify_account_restriction"
  ) {
    return verifyAccountRestriction(supabase, request, resource);
  }

  if (
    resource.execution_mode === "automatic" &&
    resource.handler_key === "delete_first_party_notifications"
  ) {
    return deleteFirstPartyNotifications(supabase, request, resource);
  }

  if (
    resource.execution_mode === "automatic" &&
    resource.handler_key === "delete_private_personalization_data"
  ) {
    return deletePrivatePersonalizationData(supabase, request, resource);
  }

  if (
    resource.execution_mode === "automatic" &&
    resource.handler_key === "delete_private_activity_data"
  ) {
    return deletePrivateActivityData(supabase, request, resource);
  }

  if (
    resource.execution_mode === "automatic" &&
    resource.handler_key === "delete_private_goals_data"
  ) {
    return deletePrivateGoalsData(supabase, request, resource);
  }

  if (
    resource.execution_mode === "automatic" &&
    resource.handler_key === "delete_matching_preferences_data"
  ) {
    return deleteMatchingPreferencesData(supabase, request, resource);
  }

  if (
    resource.execution_mode === "automatic" &&
    resource.handler_key === "delete_floor_cloud_data"
  ) {
    return deleteFloorCloudData(supabase, request, resource);
  }

  if (
    resource.execution_mode === "automatic" &&
    resource.handler_key === "delete_discussion_audience_preferences_data"
  ) {
    return deleteDiscussionAudiencePreferencesData(supabase, request, resource);
  }

  if (
    resource.execution_mode === "automatic" &&
    resource.handler_key === "delete_product_feedback_data"
  ) {
    return deleteProductFeedbackData(supabase, request, resource);
  }

  if (
    resource.execution_mode === "automatic" &&
    resource.handler_key === "delete_commerce_saves_data"
  ) {
    return deleteCommerceSavesData(supabase, request, resource);
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
    const { data: existingData, error: existingError } = await supabase
      .from("account_deletion_dispositions")
      .select("resource_key, status, reviewed_at, verification_evidence, irreversible")
      .eq("request_id", request.request_id);
    if (existingError) throw existingError;

    const existingDispositions = new Map(
      ((existingData ?? []) as ExistingDisposition[]).map((item) => [
        item.resource_key,
        item,
      ])
    );

    for (const resource of registry) {
      const existing = existingDispositions.get(resource.resource_key);
      const terminalWithEvidence =
        existing?.verification_evidence &&
        (existing.status === "completed" || existing.status === "not_applicable");
      const durable =
        terminalWithEvidence &&
        (resource.execution_mode === "automatic"
          ? existing.irreversible
          : Boolean(existing.reviewed_at));

      // Automatic resources require automatic irreversible evidence. Older manual
      // reviews cannot satisfy a handler that was enabled after the review.
      if (durable) continue;

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
          verification_evidence: result.verification_evidence ?? null,
          irreversible: result.irreversible ?? false,
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
