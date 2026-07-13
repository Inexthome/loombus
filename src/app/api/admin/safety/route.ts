import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type SafetyEventRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_id: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  enforcement_note: string | null;
  enforced_at: string | null;
  suspended_until: string | null;
};

type SensitiveProfileRow = {
  id: string;
  age_band: string | null;
  teen_safety_mode: boolean | null;
  guardian_required: boolean | null;
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
  return NextResponse.json(
    code ? { error: message, code } : { error: message },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

export async function GET(request: NextRequest) {
  let supabase;
  let adminSupabase;

  try {
    supabase = getSupabaseForRequest(request);
    adminSupabase = getAdminSupabase();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  if (!accountAccess.profile.is_admin) {
    return jsonError("Admin access required.", 403);
  }

  const eventsResult = await adminSupabase
    .from("audit_logs")
    .select("id, action, target_type, target_id, metadata, created_at, actor_id")
    .in("action", ["content_safety.blocked", "content_safety.warned"])
    .order("created_at", { ascending: false })
    .limit(250);

  if (eventsResult.error) {
    return jsonError(
      eventsResult.error.message || "Unable to load safety events.",
      500
    );
  }

  const events = (eventsResult.data ?? []) as SafetyEventRow[];
  const actorIds = [
    ...new Set(
      events
        .map((event) => event.actor_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let profiles: ProfileRow[] = [];
  let sensitiveProfiles: SensitiveProfileRow[] = [];

  if (actorIds.length > 0) {
    const [profilesResult, sensitiveResult] = await Promise.all([
      adminSupabase
        .from("profiles")
        .select(
          "id, username, full_name, avatar_url, is_admin, account_status, enforcement_reason, enforcement_note, enforced_at, suspended_until"
        )
        .in("id", actorIds),
      adminSupabase
        .from("profile_sensitive")
        .select("id, age_band, teen_safety_mode, guardian_required")
        .in("id", actorIds),
    ]);

    if (profilesResult.error) {
      return jsonError(
        profilesResult.error.message || "Unable to load safety member profiles.",
        500
      );
    }

    if (sensitiveResult.error) {
      return jsonError(
        sensitiveResult.error.message || "Unable to load safety age context.",
        500
      );
    }

    profiles = (profilesResult.data ?? []) as ProfileRow[];
    sensitiveProfiles = (sensitiveResult.data ?? []) as SensitiveProfileRow[];
  }

  const sensitiveById = new Map(
    sensitiveProfiles.map((profile) => [profile.id, profile])
  );

  const members = profiles.map((profile) => {
    const sensitive = sensitiveById.get(profile.id) ?? null;

    return {
      ...profile,
      age_band: sensitive?.age_band ?? null,
      teen_safety_mode: Boolean(sensitive?.teen_safety_mode),
      guardian_required: Boolean(sensitive?.guardian_required),
    };
  });

  return NextResponse.json(
    {
      currentAdminId: accountAccess.user.id,
      generatedAt: new Date().toISOString(),
      events,
      members,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
