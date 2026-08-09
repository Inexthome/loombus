import { NextRequest, NextResponse } from "next/server";
import {
  recordLegalOperationsAudit,
  requireLegalOperationsAccess,
} from "@/lib/legal-operations/access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REVIEW_STATUSES = new Set(["unreviewed", "draft", "requires_counsel"]);

const LIST_FIELDS = [
  "id",
  "request_number",
  "request_type",
  "status",
  "counsel_review_status",
  "emergency_review_status",
  "emergency_review_revision",
  "updated_at",
].join(",");

const DETAIL_FIELDS = [LIST_FIELDS, "emergency_criteria_summary"].join(",");

type JsonObject = Record<string, unknown>;

type ServiceClient = Awaited<ReturnType<typeof requireLegalOperationsAccess>> extends infer Result
  ? Result extends { service: infer Service }
    ? NonNullable<Service>
    : never
  : never;

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function databaseStatus(error: { code?: string } | null) {
  if (!error) return 500;
  if (["22023", "23502", "23503", "23505", "23514"].includes(error.code ?? "")) return 400;
  if (error.code === "42501") return 403;
  return 500;
}

function phaseState() {
  return {
    draftAssessmentMetadataOnly: true,
    emergencyCriteriaStandardApproved: false,
    emergencyApprovalEnabled: false,
    disclosureApprovalEnabled: false,
    exportEnabled: false,
    externalContactEnabled: false,
    externalTransmissionEnabled: false,
    memberNoticeSendingEnabled: false,
  };
}

async function requireEmergencyReviewCapability(
  service: ServiceClient,
  userId: string,
  canReviewRequests: boolean
) {
  if (!canReviewRequests) {
    return { allowed: false as const, unavailable: false as const };
  }

  const capability = await service
    .from("legal_operations_authorizations")
    .select("can_review_emergency")
    .eq("user_id", userId)
    .maybeSingle();

  if (capability.error) {
    return { allowed: false as const, unavailable: true as const };
  }

  return {
    allowed: Boolean(capability.data?.can_review_emergency),
    unavailable: false as const,
  };
}

async function auditOrFail(
  service: ServiceClient,
  actorId: string,
  action: string,
  targetType: string,
  targetId?: string | null,
  metadata?: Record<string, unknown>
) {
  const recorded = await recordLegalOperationsAudit(service, {
    actorId,
    action,
    targetType,
    targetId: targetId ?? null,
    metadata,
  });

  return recorded
    ? null
    : NextResponse.json(
        { error: "Emergency review was blocked because audit recording failed." },
        { status: 503 }
      );
}

export async function GET(request: NextRequest) {
  const access = await requireLegalOperationsAccess(request);
  if (!access.user) return access.response;

  const { service, user, authorization } = access;
  const capability = await requireEmergencyReviewCapability(
    service,
    user.id,
    authorization.can_review_requests
  );

  if (capability.unavailable) {
    return NextResponse.json(
      { error: "Emergency review capability could not be verified." },
      { status: 503 }
    );
  }
  if (!capability.allowed) {
    return NextResponse.json(
      {
        error:
          "Legal Operations capabilities can_review_requests and can_review_emergency are required.",
      },
      { status: 403 }
    );
  }

  const requestId = request.nextUrl.searchParams.get("requestId");

  if (!requestId) {
    const auditFailure = await auditOrFail(
      service,
      user.id,
      "legal_emergency_review_workspace_view_attempt",
      "legal_emergency_review_workspace",
      null,
      {
        surface: "/admin/legal-operations/emergency-review",
        foundation_version: "20260809081500",
        mode: "draft_only",
        criteria_standard_approved: false,
        emergency_approval_enabled: false,
        external_contact_enabled: false,
        external_transmission_enabled: false,
      }
    );
    if (auditFailure) return auditFailure;

    const result = await service
      .from("legal_requests")
      .select(LIST_FIELDS)
      .eq("request_type", "emergency_disclosure")
      .order("updated_at", { ascending: false })
      .limit(250);

    if (result.error) {
      return NextResponse.json(
        { error: "Unable to load emergency review metadata." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      authorization: {
        role: authorization.role,
        can_review_requests: authorization.can_review_requests,
        can_review_emergency: true,
        can_export: authorization.can_export,
        can_disclose: authorization.can_disclose,
        can_approve_emergency: authorization.can_approve_emergency,
      },
      requests: result.data ?? [],
      phase: phaseState(),
    });
  }

  if (!UUID_PATTERN.test(requestId)) {
    return NextResponse.json({ error: "Invalid legal-request identifier." }, { status: 400 });
  }

  const auditFailure = await auditOrFail(
    service,
    user.id,
    "legal_emergency_review_request_view_attempt",
    "legal_request",
    requestId,
    {
      surface: "/admin/legal-operations/emergency-review",
      mode: "draft_only",
    }
  );
  if (auditFailure) return auditFailure;

  const result = await service
    .from("legal_requests")
    .select(DETAIL_FIELDS)
    .eq("id", requestId)
    .eq("request_type", "emergency_disclosure")
    .maybeSingle();

  if (result.error) {
    return NextResponse.json(
      { error: "Unable to load emergency review metadata." },
      { status: 500 }
    );
  }
  if (!result.data) {
    return NextResponse.json({ error: "Emergency-disclosure request not found." }, { status: 404 });
  }

  return NextResponse.json({
    authorization: {
      role: authorization.role,
      can_review_requests: authorization.can_review_requests,
      can_review_emergency: true,
      can_export: authorization.can_export,
      can_disclose: authorization.can_disclose,
      can_approve_emergency: authorization.can_approve_emergency,
    },
    request: result.data,
    phase: phaseState(),
  });
}

export async function POST(request: NextRequest) {
  const access = await requireLegalOperationsAccess(request);
  if (!access.user) return access.response;

  const { service, user, authorization } = access;
  const capability = await requireEmergencyReviewCapability(
    service,
    user.id,
    authorization.can_review_requests
  );

  if (capability.unavailable) {
    return NextResponse.json(
      { error: "Emergency review capability could not be verified." },
      { status: 503 }
    );
  }
  if (!capability.allowed) {
    return NextResponse.json(
      {
        error:
          "Legal Operations capabilities can_review_requests and can_review_emergency are required.",
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (cleanText(body.operation, 80) !== "update_emergency_review_draft") {
    return NextResponse.json(
      {
        error:
          "Only draft emergency review metadata updates are enabled on this route. Emergency approval and external transmission are disabled.",
      },
      { status: 409 }
    );
  }

  const requestId = cleanText(body.requestId, 80);
  if (!requestId || !UUID_PATTERN.test(requestId)) {
    return NextResponse.json({ error: "Valid requestId is required." }, { status: 400 });
  }

  const reviewStatus = cleanText(body.reviewStatus, 100);
  if (!reviewStatus || !REVIEW_STATUSES.has(reviewStatus)) {
    return NextResponse.json({ error: "Emergency review status is invalid." }, { status: 400 });
  }

  const emergencyCriteriaSummary = cleanText(body.emergencyCriteriaSummary, 4000);
  if (reviewStatus === "unreviewed" && emergencyCriteriaSummary) {
    return NextResponse.json(
      { error: "Use Draft or Requires Counsel when emergency assessment metadata is recorded." },
      { status: 400 }
    );
  }

  const current = await service
    .from("legal_requests")
    .select("id,request_type,emergency_review_revision")
    .eq("id", requestId)
    .maybeSingle();

  if (current.error) {
    return NextResponse.json({ error: "Unable to verify the legal request." }, { status: 500 });
  }
  if (!current.data) {
    return NextResponse.json({ error: "Legal request not found." }, { status: 404 });
  }
  if (current.data.request_type !== "emergency_disclosure") {
    return NextResponse.json(
      { error: "Only emergency-disclosure request records can enter this review workspace." },
      { status: 409 }
    );
  }

  const currentRevision = Number(current.data.emergency_review_revision ?? 0);
  const nextRevision = currentRevision + 1;

  const auditFailure = await auditOrFail(
    service,
    user.id,
    "legal_emergency_review_draft_update_attempt",
    "legal_request",
    requestId,
    {
      surface: "/admin/legal-operations/emergency-review",
      fields: ["emergency_review_status", "emergency_criteria_summary"],
      review_status: reviewStatus,
      from_revision: currentRevision,
      to_revision: nextRevision,
      draft_only: true,
      criteria_standard_approved: false,
      emergency_approval_enabled: false,
    }
  );
  if (auditFailure) return auditFailure;

  const result = await service
    .from("legal_requests")
    .update({
      emergency_review_status: reviewStatus,
      emergency_review_revision: nextRevision,
      emergency_criteria_summary: emergencyCriteriaSummary,
      updated_by: user.id,
    })
    .eq("id", requestId)
    .eq("request_type", "emergency_disclosure")
    .eq("emergency_review_revision", currentRevision)
    .select(DETAIL_FIELDS)
    .maybeSingle();

  if (result.error) {
    return NextResponse.json(
      { error: "Unable to update draft emergency review metadata." },
      { status: databaseStatus(result.error) }
    );
  }
  if (!result.data) {
    return NextResponse.json(
      { error: "The emergency review draft changed concurrently. Reload and try again." },
      { status: 409 }
    );
  }

  return NextResponse.json({ request: result.data, phase: phaseState() });
}
