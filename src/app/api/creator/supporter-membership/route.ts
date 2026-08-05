import { NextRequest, NextResponse } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  createMemberPrivacyServiceClient,
  requireMemberUser,
} from "@/lib/member-privacy-server";

type ProfileAccess = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Creator supporter service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const { data: profile } = await service
    .from("profiles")
    .select("account_status, enforcement_reason, suspended_until")
    .eq("id", user.id)
    .maybeSingle();

  const enforcement = getAccountEnforcementResult(
    (profile ?? null) as ProfileAccess | null
  );
  if (!enforcement.allowed) {
    return jsonError(
      enforcement.errorMessage ?? "This account cannot change supporter memberships.",
      403
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "join").trim().toLowerCase();
  const creatorId = String(body.creatorId ?? "").trim();

  if (!UUID_PATTERN.test(creatorId)) {
    return jsonError("Invalid creator id.", 400);
  }

  if (action === "join" || action === "change_tier") {
    const tierId = String(body.tierId ?? "").trim();
    if (!UUID_PATTERN.test(tierId)) return jsonError("Choose a valid supporter tier.", 400);

    const { data, error } = await service.rpc("join_creator_supporter_program", {
      p_creator_id: creatorId,
      p_supporter_id: user.id,
      p_tier_id: tierId,
    });

    if (error) return jsonError(error.message, error.code === "42501" ? 403 : 400);
    return NextResponse.json(
      { membership: data },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (action === "leave") {
    const { data, error } = await service.rpc("end_creator_supporter_membership", {
      p_creator_id: creatorId,
      p_supporter_id: user.id,
      p_actor_id: user.id,
    });

    if (error) return jsonError(error.message, error.code === "42501" ? 403 : 400);
    return NextResponse.json(
      { membership: data },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (action === "remove") {
    const supporterId = String(body.supporterId ?? "").trim();
    if (!UUID_PATTERN.test(supporterId)) {
      return jsonError("Invalid supporter id.", 400);
    }

    const { data, error } = await service.rpc("end_creator_supporter_membership", {
      p_creator_id: creatorId,
      p_supporter_id: supporterId,
      p_actor_id: user.id,
    });

    if (error) return jsonError(error.message, error.code === "42501" ? 403 : 400);
    return NextResponse.json(
      { membership: data },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  return jsonError("Unsupported supporter action.", 400);
}
