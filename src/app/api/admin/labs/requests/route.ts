import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

const LABS_STATUSES = [
  "submitted",
  "reviewing",
  "planned",
  "shipped",
  "declined",
] as const;

type LabsStatus = (typeof LABS_STATUSES)[number];

type LabsRequestRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: LabsStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

type EntitlementRow = {
  user_id: string;
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
  updated_at: string | null;
};

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration.");
  }

  const authorization = request.headers.get("authorization") ?? "";

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Admin Supabase configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isLabsStatus(value: unknown): value is LabsStatus {
  return (
    typeof value === "string" &&
    (LABS_STATUSES as readonly string[]).includes(value)
  );
}

function getLabsAccessLabel(
  profile: ProfileRow | null,
  entitlement: EntitlementRow | null
) {
  if (profile?.is_admin || entitlement?.tier === "admin") return "admin";
  if (!entitlement?.ai_assisted_enabled) return "free";

  if (
    entitlement.tier === "premium_plus" ||
    (entitlement.tier === "premium" &&
      (entitlement.monthly_summary_limit ?? 0) > 50)
  ) {
    return "premium_plus";
  }

  if (entitlement.tier === "premium") return "premium";
  return "free";
}

async function requireAdmin(request: NextRequest) {
  let supabase;
  let adminSupabase;

  try {
    supabase = getSupabaseForRequest(request);
    adminSupabase = getAdminSupabase();
  } catch {
    return {
      accountAccess: null,
      adminSupabase: null,
      error: jsonError("Server configuration error.", 500),
    };
  }

  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return {
      accountAccess: null,
      adminSupabase: null,
      error: jsonError(
        accountAccess.error,
        accountAccess.status,
        accountAccess.code
      ),
    };
  }

  if (!accountAccess.profile.is_admin) {
    return {
      accountAccess: null,
      adminSupabase: null,
      error: jsonError("Admin access required.", 403),
    };
  }

  return { accountAccess, adminSupabase, error: null };
}

async function enrichRequests(adminSupabase: any, rows: LabsRequestRow[]) {
  if (rows.length === 0) return [];

  const requestIds = rows.map((row) => row.id);
  const profileIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.user_id, row.reviewed_by])
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const requesterIds = [...new Set(rows.map((row) => row.user_id))];

  const [votesResult, profilesResult, entitlementsResult] = await Promise.all([
    adminSupabase
      .from("labs_feature_request_votes")
      .select("request_id")
      .in("request_id", requestIds),
    profileIds.length > 0
      ? adminSupabase
          .from("profiles")
          .select(
            "id, username, full_name, avatar_url, is_admin, account_status, enforcement_reason, suspended_until"
          )
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    requesterIds.length > 0
      ? adminSupabase
          .from("user_ai_entitlements")
          .select(
            "user_id, tier, ai_assisted_enabled, monthly_summary_limit, updated_at"
          )
          .in("user_id", requesterIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (votesResult.error) {
    throw new Error(votesResult.error.message || "Unable to load Labs votes.");
  }

  if (profilesResult.error) {
    throw new Error(
      profilesResult.error.message || "Unable to load Labs member context."
    );
  }

  if (entitlementsResult.error) {
    throw new Error(
      entitlementsResult.error.message || "Unable to load Labs access context."
    );
  }

  const voteCounts = ((votesResult.data ?? []) as { request_id: string }[]).reduce<
    Record<string, number>
  >((counts, vote) => {
    counts[vote.request_id] = (counts[vote.request_id] ?? 0) + 1;
    return counts;
  }, {});

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const entitlements = (entitlementsResult.data ?? []) as EntitlementRow[];
  const entitlementMap = new Map(
    entitlements.map((entitlement) => [entitlement.user_id, entitlement])
  );

  return rows.map((row) => {
    const requester = profileMap.get(row.user_id) ?? null;
    const reviewer = row.reviewed_by
      ? profileMap.get(row.reviewed_by) ?? null
      : null;
    const entitlement = entitlementMap.get(row.user_id) ?? null;

    return {
      ...row,
      vote_count: voteCounts[row.id] ?? 0,
      requester,
      reviewer,
      entitlement,
      labs_access: getLabsAccessLabel(requester, entitlement),
    };
  });
}

export async function GET(request: NextRequest) {
  const { accountAccess, adminSupabase, error } = await requireAdmin(request);

  if (error || !accountAccess || !adminSupabase) return error;

  const { data, error: requestError } = await adminSupabase
    .from("labs_feature_requests")
    .select(
      "id, user_id, title, description, status, admin_note, reviewed_by, reviewed_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (requestError) {
    return jsonError(
      requestError.message || "Unable to load Labs requests.",
      500
    );
  }

  try {
    const requests = await enrichRequests(
      adminSupabase,
      (data ?? []) as LabsRequestRow[]
    );

    return NextResponse.json(
      {
        currentAdminId: accountAccess.user.id,
        generatedAt: new Date().toISOString(),
        requests,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (loadError) {
    return jsonError(
      loadError instanceof Error
        ? loadError.message
        : "Unable to load Labs operational context.",
      500
    );
  }
}

export async function PATCH(request: NextRequest) {
  const { accountAccess, adminSupabase, error } = await requireAdmin(request);

  if (error || !accountAccess || !adminSupabase) return error;

  const body = await request.json().catch(() => null);
  const requestId = body?.requestId;
  const status = body?.status;
  const adminNote =
    typeof body?.adminNote === "string" ? body.adminNote.trim() : "";

  if (!isValidUuid(requestId)) {
    return jsonError("Invalid Labs request id.", 400);
  }

  if (!isLabsStatus(status)) {
    return jsonError("Invalid Labs request status.", 400);
  }

  if (adminNote.length > 2000) {
    return jsonError("Admin note is too long.", 400);
  }

  const { data: existing, error: existingError } = await adminSupabase
    .from("labs_feature_requests")
    .select("id, user_id, title, status")
    .eq("id", requestId)
    .maybeSingle();

  if (existingError) {
    return jsonError(
      existingError.message || "Unable to verify the Labs request.",
      500
    );
  }

  if (!existing) {
    return jsonError("Labs request not found.", 404);
  }

  const reviewedAt = new Date().toISOString();
  const { data, error: updateError } = await adminSupabase
    .from("labs_feature_requests")
    .update({
      status,
      admin_note: adminNote || null,
      reviewed_by: accountAccess.user.id,
      reviewed_at: reviewedAt,
    })
    .eq("id", requestId)
    .select(
      "id, user_id, title, description, status, admin_note, reviewed_by, reviewed_at, created_at, updated_at"
    )
    .single();

  if (updateError) {
    return jsonError(
      updateError.message || "Unable to update Labs request.",
      400
    );
  }

  await logAuditEvent({
    actor_id: accountAccess.user.id,
    action: "labs.request_updated",
    target_type: "labs_feature_request",
    target_id: requestId,
    metadata: {
      previous_status: existing.status,
      status,
      requester_id: existing.user_id,
      has_admin_note: Boolean(adminNote),
    },
  });

  try {
    const [enrichedRequest] = await enrichRequests(adminSupabase, [
      data as LabsRequestRow,
    ]);

    return NextResponse.json(
      { request: enrichedRequest ?? data },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { request: data },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { accountAccess, adminSupabase, error } = await requireAdmin(request);

  if (error || !accountAccess || !adminSupabase) return error;

  const body = await request.json().catch(() => null);
  const requestId = body?.requestId;

  if (!isValidUuid(requestId)) {
    return jsonError("Invalid Labs request id.", 400);
  }

  const { data: existing, error: existingError } = await adminSupabase
    .from("labs_feature_requests")
    .select("id, user_id, title, status")
    .eq("id", requestId)
    .maybeSingle();

  if (existingError) {
    return jsonError(
      existingError.message || "Unable to verify the Labs request.",
      500
    );
  }

  if (!existing) {
    return jsonError("Labs request not found.", 404);
  }

  const { error: deleteError } = await adminSupabase
    .from("labs_feature_requests")
    .delete()
    .eq("id", requestId);

  if (deleteError) {
    return jsonError(
      deleteError.message || "Unable to delete Labs request.",
      400
    );
  }

  await logAuditEvent({
    actor_id: accountAccess.user.id,
    action: "labs.request_deleted",
    target_type: "labs_feature_request",
    target_id: requestId,
    metadata: {
      requester_id: existing.user_id,
      status: existing.status,
      title: existing.title,
    },
  });

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
