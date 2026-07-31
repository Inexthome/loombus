import { NextResponse, type NextRequest } from "next/server";
import { createFloorRequestSupabase, createFloorServiceSupabase } from "@/lib/floor-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type RouteContext = { params: Promise<{ proposalId: string }> };

const FINAL_OUTCOMES = new Set(["correct", "incorrect", "partial"]);

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { proposalId } = await context.params;
  const supabase = createFloorRequestSupabase(request);
  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return jsonError(accountAccess.error, accountAccess.status);
  }
  if (!accountAccess.profile.is_admin) {
    return jsonError("Admin access required.", 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body.", 400);
  }
  const payload = body as Record<string, unknown>;
  const action = asString(payload.action);
  const note = asString(payload.note).slice(0, 2000) || null;

  const service = createFloorServiceSupabase();

  if (action === "approve") {
    const outcome = asString(payload.outcome);
    if (!FINAL_OUTCOMES.has(outcome)) {
      return jsonError("Choose a valid outcome (correct, incorrect, or partial).", 400);
    }

    const { error } = await service.rpc("approve_floor_call_resolution_proposal", {
      p_proposal_id: proposalId,
      p_admin_id: accountAccess.profile.id,
      p_final_outcome: outcome,
      p_review_note: note,
    });

    if (error) {
      return jsonError(error.message || "Unable to approve the proposal.", 400);
    }

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  if (action === "reject") {
    const { data, error } = await service
      .from("floor_call_resolution_proposals")
      .update({
        status: "rejected",
        reviewed_by: accountAccess.profile.id,
        reviewed_at: new Date().toISOString(),
        review_note: note,
      })
      .eq("id", proposalId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error) {
      return jsonError(error.message || "Unable to reject the proposal.", 500);
    }
    if (!data) {
      return jsonError("This proposal has already been reviewed.", 409);
    }

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  return jsonError("action must be 'approve' or 'reject'.", 400);
}
