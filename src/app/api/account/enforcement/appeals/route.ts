import { NextResponse, type NextRequest } from "next/server";
import { authenticateEnforcementRequest } from "@/lib/enforcement-request-auth";
import { createMemberAppeal } from "@/lib/enforcement-server";
import { createAdminNotifications } from "@/lib/notifications";

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

export async function POST(request: NextRequest) {
  const auth = await authenticateEnforcementRequest(
    request.headers.get("authorization") ?? ""
  );

  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  const body = await request.json().catch(() => null);
  const decisionId = body?.decisionId;
  const statement = typeof body?.statement === "string" ? body.statement.trim() : "";
  const additionalContext =
    typeof body?.additionalContext === "string" ? body.additionalContext.trim() : "";
  const hasNewInformation = body?.hasNewInformation === true;

  if (!isValidUuid(decisionId)) {
    return jsonResponse({ error: "Invalid enforcement decision." }, 400);
  }

  if (statement.length < 20 || statement.length > 6000) {
    return jsonResponse(
      { error: "Your appeal statement must be between 20 and 6,000 characters." },
      400
    );
  }

  if (additionalContext.length > 6000) {
    return jsonResponse(
      { error: "Additional context must be 6,000 characters or fewer." },
      400
    );
  }

  try {
    const appeal = await createMemberAppeal({
      decisionId,
      userId: auth.user.id,
      statement,
      additionalContext: additionalContext || null,
      hasNewInformation,
    });

    const displayName =
      auth.profile.full_name?.trim() || auth.profile.username?.trim() || "A Loombus member";
    const notification = await createAdminNotifications({
      actor_id: auth.user.id,
      type: "enforcement_appeal_submitted",
      target_type: "enforcement_appeal",
      target_id: appeal.id,
      message: `${displayName} submitted an enforcement appeal.`,
    });

    if (notification.error) {
      console.error("Enforcement appeal Admin notification failed:", notification.error.message);
    }

    return jsonResponse({
      ok: true,
      appeal: {
        id: appeal.id,
        decisionId: appeal.decision_id,
        status: appeal.status,
        outcome: appeal.outcome,
        statement: appeal.statement,
        additionalContext: appeal.additional_context,
        hasNewInformation: appeal.has_new_information,
        submittedAt: appeal.submitted_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit appeal.";
    const status =
      message.includes("not eligible") ||
      message.includes("deadline") ||
      message.includes("already open")
        ? 409
        : 500;
    return jsonResponse({ error: message }, status);
  }
}
