import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type SupportRequestRow = {
  id: string;
  user_id: string | null;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: "new" | "reviewing" | "resolved" | "closed";
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SupportProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  account_status: string | null;
  enforcement_reason: string | null;
  enforced_at: string | null;
  suspended_until: string | null;
};

const SUPPORT_STATUSES = new Set(["new", "reviewing", "resolved", "closed"]);

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration.");
  }

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

export async function GET(request: NextRequest) {
  const { accountAccess, adminSupabase, error: adminError } = await requireAdmin(request);

  if (adminError || !accountAccess || !adminSupabase) {
    return adminError;
  }

  const { data, error } = await adminSupabase
    .from("support_requests")
    .select(
      "id, user_id, email, category, subject, message, status, admin_note, reviewed_by, reviewed_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return jsonError(error.message || "Unable to load support requests.", 500);
  }

  const requests = (data ?? []) as SupportRequestRow[];
  const profileIds = [
    ...new Set(
      requests
        .flatMap((item) => [item.user_id, item.reviewed_by])
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let profiles: SupportProfileRow[] = [];

  if (profileIds.length > 0) {
    const { data: profileData, error: profileError } = await adminSupabase
      .from("profiles")
      .select(
        "id, username, full_name, avatar_url, account_status, enforcement_reason, enforced_at, suspended_until"
      )
      .in("id", profileIds);

    if (profileError) {
      return jsonError(profileError.message || "Unable to load support member context.", 500);
    }

    profiles = (profileData ?? []) as SupportProfileRow[];
  }

  return NextResponse.json(
    {
      currentAdminId: accountAccess.user.id,
      generatedAt: new Date().toISOString(),
      requests,
      profiles,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

export async function PATCH(request: NextRequest) {
  const { accountAccess, adminSupabase, error: adminError } = await requireAdmin(request);

  if (adminError || !accountAccess || !adminSupabase) {
    return adminError;
  }

  const body = await request.json().catch(() => null);
  const requestId = body?.requestId;
  const status = typeof body?.status === "string" ? body.status.trim() : "";
  const adminNote =
    typeof body?.adminNote === "string" ? body.adminNote.trim().slice(0, 2000) : "";

  if (!isValidUuid(requestId)) {
    return jsonError("Invalid support request id.", 400);
  }

  if (!SUPPORT_STATUSES.has(status)) {
    return jsonError("Invalid support request status.", 400);
  }

  const now = new Date().toISOString();
  const { data, error } = await adminSupabase
    .from("support_requests")
    .update({
      status,
      admin_note: adminNote || null,
      reviewed_by: accountAccess.user.id,
      reviewed_at: now,
    })
    .eq("id", requestId)
    .select(
      "id, user_id, email, category, subject, message, status, admin_note, reviewed_by, reviewed_at, created_at, updated_at"
    )
    .single<SupportRequestRow>();

  if (error) {
    return jsonError(error.message || "Unable to update support request.", 400);
  }

  await logAuditEvent({
    actor_id: accountAccess.user.id,
    action: "support_request.updated",
    target_type: "support_request",
    target_id: requestId,
    metadata: {
      status,
      has_admin_note: Boolean(adminNote),
    },
  });

  return NextResponse.json(
    { request: data },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
