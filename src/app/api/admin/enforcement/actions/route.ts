import { NextResponse, type NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import {
  APPEAL_OUTCOME_LABELS,
  isAppealOutcome,
  type AppealOutcome,
} from "@/lib/enforcement-contract";
import { authenticateEnforcementRequest } from "@/lib/enforcement-request-auth";
import {
  getEnforcementServiceClient,
  restoreDecisionTarget,
  type EnforcementAppealRow,
  type EnforcementDecisionRow,
} from "@/lib/enforcement-server";
import { createNotification } from "@/lib/notifications";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
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

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function loadAppealAndDecision(appealId: string) {
  const service = getEnforcementServiceClient();
  const appealResult = await service
    .from("enforcement_appeals")
    .select("*")
    .eq("id", appealId)
    .maybeSingle<EnforcementAppealRow>();
  if (appealResult.error) throw appealResult.error;
  if (!appealResult.data) throw new Error("Appeal not found.");

  const decisionResult = await service
    .from("enforcement_decisions")
    .select("*")
    .eq("id", appealResult.data.decision_id)
    .maybeSingle<EnforcementDecisionRow>();
  if (decisionResult.error) throw decisionResult.error;
  if (!decisionResult.data) throw new Error("Enforcement decision not found.");

  return { service, appeal: appealResult.data, decision: decisionResult.data };
}

async function notifyAppellant(
  appeal: EnforcementAppealRow,
  actorId: string,
  message: string
) {
  const notification = await createNotification({
    user_id: appeal.appellant_user_id,
    actor_id: actorId,
    type: "enforcement_appeal_update",
    target_type: "enforcement_appeal",
    target_id: appeal.id,
    message,
  });

  if (notification.error) {
    console.error("Enforcement appeal notification failed:", notification.error.message);
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateEnforcementRequest(
    request.headers.get("authorization") ?? "",
    { requireAdmin: true }
  );

  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  const appealId = body?.appealId;

  if (!isValidUuid(appealId)) {
    return jsonResponse({ error: "Invalid appeal id." }, 400);
  }

  try {
    const { service, appeal, decision } = await loadAppealAndDecision(appealId);
    const now = new Date().toISOString();

    if (action === "assign_reviewer") {
      const reviewerId = isValidUuid(body?.reviewerId) ? body.reviewerId : auth.user.id;
      const conflict = reviewerId === decision.actor_user_id;
      const update = await service
        .from("enforcement_appeals")
        .update({
          assigned_reviewer_id: reviewerId,
          conflict_status: conflict ? "potential" : "none",
          status:
            appeal.status === "APL.SUBMITTED" ? "APL.QUEUED" : appeal.status,
        })
        .eq("id", appeal.id)
        .select("*")
        .single<EnforcementAppealRow>();
      if (update.error) throw update.error;

      const event = await service.from("enforcement_events").insert({
        decision_id: decision.id,
        appeal_id: appeal.id,
        event_type: "appeal_reviewer_assigned",
        actor_user_id: auth.user.id,
        member_visible: false,
        metadata: { reviewer_id: reviewerId, conflict_status: conflict ? "potential" : "none" },
      });
      if (event.error) throw event.error;

      await logAuditEvent({
        actor_id: auth.user.id,
        action: "enforcement.appeal_reviewer_assigned",
        target_type: "enforcement_appeal",
        target_id: appeal.id,
        metadata: { decision_id: decision.id, reviewer_id: reviewerId },
      });

      return jsonResponse({ ok: true, appeal: update.data });
    }

    if (action === "start_review") {
      const conflictOverrideReason = cleanText(body?.conflictOverrideReason, 1000);
      const conflict = decision.actor_user_id === auth.user.id;
      if (conflict && !conflictOverrideReason) {
        return jsonResponse(
          {
            error:
              "The original decision maker cannot review this appeal without a documented conflict override.",
          },
          409
        );
      }

      const update = await service
        .from("enforcement_appeals")
        .update({
          assigned_reviewer_id: auth.user.id,
          status: "APL.UNDER_REVIEW",
          review_started_at: appeal.review_started_at ?? now,
          conflict_status: conflict ? "overridden" : "none",
          conflict_override_reason: conflict ? conflictOverrideReason : null,
        })
        .eq("id", appeal.id)
        .select("*")
        .single<EnforcementAppealRow>();
      if (update.error) throw update.error;

      const event = await service.from("enforcement_events").insert({
        decision_id: decision.id,
        appeal_id: appeal.id,
        event_type: "appeal_review_started",
        actor_user_id: auth.user.id,
        member_visible: true,
        member_message: "Your appeal is under review.",
        metadata: { conflict_override: conflict },
      });
      if (event.error) throw event.error;

      await notifyAppellant(appeal, auth.user.id, "Your enforcement appeal is under review.");
      await logAuditEvent({
        actor_id: auth.user.id,
        action: "enforcement.appeal_review_started",
        target_type: "enforcement_appeal",
        target_id: appeal.id,
        metadata: { decision_id: decision.id, conflict_override: conflict },
      });

      return jsonResponse({ ok: true, appeal: update.data });
    }

    if (action === "request_information") {
      const memberMessage = cleanText(body?.memberMessage, 2000);
      if (memberMessage.length < 10) {
        return jsonResponse({ error: "Add a clear request for information." }, 400);
      }

      const update = await service
        .from("enforcement_appeals")
        .update({
          assigned_reviewer_id: auth.user.id,
          status: "APL.NEEDS_INFORMATION",
          review_started_at: appeal.review_started_at ?? now,
          member_outcome_message: memberMessage,
        })
        .eq("id", appeal.id)
        .select("*")
        .single<EnforcementAppealRow>();
      if (update.error) throw update.error;

      const event = await service.from("enforcement_events").insert({
        decision_id: decision.id,
        appeal_id: appeal.id,
        event_type: "appeal_information_requested",
        actor_user_id: auth.user.id,
        member_visible: true,
        member_message: memberMessage,
      });
      if (event.error) throw event.error;

      await notifyAppellant(appeal, auth.user.id, memberMessage);
      await logAuditEvent({
        actor_id: auth.user.id,
        action: "enforcement.appeal_information_requested",
        target_type: "enforcement_appeal",
        target_id: appeal.id,
        metadata: { decision_id: decision.id },
      });

      return jsonResponse({ ok: true, appeal: update.data });
    }

    if (action === "resolve_appeal") {
      const outcome = body?.outcome;
      if (!isAppealOutcome(outcome)) {
        return jsonResponse({ error: "Invalid appeal outcome." }, 400);
      }

      const memberOutcomeMessage = cleanText(body?.memberOutcomeMessage, 3000);
      const internalReviewNote = cleanText(body?.internalReviewNote, 6000);
      const conflictOverrideReason = cleanText(body?.conflictOverrideReason, 1000);
      const manualActionConfirmed = body?.manualActionConfirmed === true;
      const conflict = decision.actor_user_id === auth.user.id;

      if (memberOutcomeMessage.length < 10) {
        return jsonResponse({ error: "Add a clear member-facing outcome message." }, 400);
      }

      if (conflict && !conflictOverrideReason) {
        return jsonResponse(
          {
            error:
              "The original decision maker cannot resolve this appeal without a documented conflict override.",
          },
          409
        );
      }

      if (outcome === "APL.OUTCOME_MODIFIED" && !manualActionConfirmed) {
        return jsonResponse(
          {
            error:
              "Confirm that the modified product action was completed before recording a modified outcome.",
          },
          409
        );
      }

      let restoration: { status: string; restored: boolean } | null = null;
      let decisionStatus = "upheld";
      let appealStatus = "APL.DECIDED";
      let decidedAt: string | null = now;
      let closedAt: string | null = now;

      if (outcome === "APL.OUTCOME_REVERSED") {
        restoration = await restoreDecisionTarget({
          decision,
          appealId: appeal.id,
          actorUserId: auth.user.id,
          memberMessage: memberOutcomeMessage,
          internalNote: internalReviewNote || null,
        });
        decisionStatus = "reversed";
      } else if (outcome === "APL.OUTCOME_MODIFIED") {
        decisionStatus = "modified";
      } else if (outcome === "APL.OUTCOME_REMANDED") {
        decisionStatus = "remanded";
        appealStatus = "APL.SPECIALIST_REVIEW";
        decidedAt = null;
        closedAt = null;
      } else if (outcome === "APL.OUTCOME_UNABLE_TO_REVIEW") {
        decisionStatus = "unable_to_review";
      }

      if (outcome !== "APL.OUTCOME_REVERSED") {
        const decisionUpdate = await service
          .from("enforcement_decisions")
          .update({
            status: decisionStatus,
            reviewer_user_id: auth.user.id,
            resolved_at: outcome === "APL.OUTCOME_REMANDED" ? null : now,
            restoration_status:
              outcome === "APL.OUTCOME_MODIFIED"
                ? "RST.PARTIAL"
                : decision.restoration_status,
            restoration_note:
              outcome === "APL.OUTCOME_MODIFIED"
                ? memberOutcomeMessage
                : decision.restoration_note,
          })
          .eq("id", decision.id);
        if (decisionUpdate.error) throw decisionUpdate.error;
      }

      const appealUpdate = await service
        .from("enforcement_appeals")
        .update({
          assigned_reviewer_id: auth.user.id,
          status: appealStatus,
          outcome,
          conflict_status: conflict ? "overridden" : "none",
          conflict_override_reason: conflict ? conflictOverrideReason : null,
          member_outcome_message: memberOutcomeMessage,
          internal_review_note: internalReviewNote || null,
          review_started_at: appeal.review_started_at ?? now,
          decided_at: decidedAt,
          closed_at: closedAt,
        })
        .eq("id", appeal.id)
        .select("*")
        .single<EnforcementAppealRow>();
      if (appealUpdate.error) throw appealUpdate.error;

      const event = await service.from("enforcement_events").insert({
        decision_id: decision.id,
        appeal_id: appeal.id,
        event_type: "appeal_outcome_recorded",
        actor_user_id: auth.user.id,
        member_visible: true,
        member_message: memberOutcomeMessage,
        internal_note: internalReviewNote || null,
        metadata: {
          outcome,
          outcome_label: APPEAL_OUTCOME_LABELS[outcome as AppealOutcome],
          restoration_status: restoration?.status ?? null,
          conflict_override: conflict,
        },
      });
      if (event.error) throw event.error;

      await notifyAppellant(appeal, auth.user.id, memberOutcomeMessage);
      await logAuditEvent({
        actor_id: auth.user.id,
        action: "enforcement.appeal_outcome_recorded",
        target_type: "enforcement_appeal",
        target_id: appeal.id,
        metadata: {
          decision_id: decision.id,
          outcome,
          restoration_status: restoration?.status ?? null,
          conflict_override: conflict,
        },
      });

      return jsonResponse({
        ok: true,
        appeal: appealUpdate.data,
        decisionStatus,
        restoration,
      });
    }

    return jsonResponse({ error: "Unsupported enforcement action." }, 400);
  } catch (error) {
    console.error("Unable to update enforcement appeal:", error);
    const message = error instanceof Error ? error.message : "Unable to update appeal.";
    const status = message.includes("not found") ? 404 : 500;
    return jsonResponse({ error: message }, status);
  }
}
