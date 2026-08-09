import { NextRequest, NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";

export type LegalOperationsAuthorization = {
  user_id: string;
  role: string;
  can_intake: boolean;
  can_review_requests: boolean;
  can_preserve: boolean;
  can_prepare_disclosure: boolean;
  can_export: boolean;
  can_disclose: boolean;
  can_approve_emergency: boolean;
  can_manage_access: boolean;
  active: boolean;
  appointed_by: string | null;
  appointed_at: string;
  revoked_at: string | null;
  notes: string | null;
};

export type LegalOperationsCapability =
  | "can_intake"
  | "can_review_requests"
  | "can_preserve"
  | "can_prepare_disclosure"
  | "can_export"
  | "can_disclose"
  | "can_approve_emergency"
  | "can_manage_access";

export function getLegalOperationsServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getRequestAuthClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const authorization = request.headers.get("authorization") ?? "";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

export async function requireLegalOperationsAccess(
  request: NextRequest,
  capability?: LegalOperationsCapability
): Promise<
  | {
      user: User;
      authorization: LegalOperationsAuthorization;
      service: NonNullable<ReturnType<typeof getLegalOperationsServiceClient>>;
      response: null;
    }
  | {
      user: null;
      authorization: null;
      service: null;
      response: NextResponse;
    }
> {
  const auth = getRequestAuthClient(request);
  const service = getLegalOperationsServiceClient();

  if (!auth || !service) {
    return {
      user: null,
      authorization: null,
      service: null,
      response: NextResponse.json(
        { error: "Legal Operations service configuration is unavailable." },
        { status: 503 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await auth.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      authorization: null,
      service: null,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const profileResult = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileResult.error) {
    return {
      user: null,
      authorization: null,
      service: null,
      response: NextResponse.json(
        { error: "Legal Operations authorization could not be verified." },
        { status: 503 }
      ),
    };
  }

  if (!profileResult.data?.is_admin) {
    return {
      user: null,
      authorization: null,
      service: null,
      response: NextResponse.json(
        { error: "Platform administrator access is required." },
        { status: 403 }
      ),
    };
  }

  const authorizationResult = await service
    .from("legal_operations_authorizations")
    .select(
      "user_id,role,can_intake,can_review_requests,can_preserve,can_prepare_disclosure,can_export,can_disclose,can_approve_emergency,can_manage_access,active,appointed_by,appointed_at,revoked_at,notes"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (authorizationResult.error) {
    return {
      user: null,
      authorization: null,
      service: null,
      response: NextResponse.json(
        { error: "Legal Operations authorization could not be verified." },
        { status: 503 }
      ),
    };
  }

  const authorization = authorizationResult.data as LegalOperationsAuthorization | null;
  if (!authorization?.active || authorization.revoked_at) {
    return {
      user: null,
      authorization: null,
      service: null,
      response: NextResponse.json(
        { error: "Active Legal Operations authorization is required." },
        { status: 403 }
      ),
    };
  }

  if (capability && !authorization[capability]) {
    return {
      user: null,
      authorization: null,
      service: null,
      response: NextResponse.json(
        { error: `Legal Operations capability ${capability} is required.` },
        { status: 403 }
      ),
    };
  }

  return { user, authorization, service, response: null };
}

export async function recordLegalOperationsAudit(
  service: NonNullable<ReturnType<typeof getLegalOperationsServiceClient>>,
  event: {
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const result = await service.from("audit_logs").insert({
    actor_id: event.actorId,
    action: event.action,
    target_type: event.targetType,
    target_id: event.targetId ?? null,
    metadata: event.metadata ?? null,
  });

  return !result.error;
}
