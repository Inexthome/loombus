import { NextRequest, NextResponse } from "next/server";
import {
  recordLegalOperationsAudit,
  requireLegalOperationsAccess,
} from "@/lib/legal-operations/access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COORDINATION_TYPES = new Set([
  "child_safety",
  "imminent_danger",
  "high_risk_safety",
]);

const COORDINATION_STATUSES = new Set([
  "draft",
  "legal_review_requested",
  "legal_review_acknowledged",
  "requires_counsel",
]);

// Administrative routing scope only. This list is not an emergency, reporting,
// disclosure, or substantive legal standard.
const SAFETY_CASE_CATEGORIES = [
  "child_safety",
  "sexual_exploitation",
  "sextortion",
  "credible_threat",
  "self_harm",
  "trafficking",
  "dangerous_organization",
];

const CASE_FIELDS = [
  "id",
  "case_number",
  "severity",
  "primary_category",
  "status",
  "updated_at",
].join(",");

const COORDINATION_LIST_FIELDS = [
  "id",
  "trust_safety_case_id",
  "legal_request_id",
  "coordination_type",
  "status",
  "assigned_legal_reviewer",
  "revision",
  "updated_at",
].join(",");

const COORDINATION_DETAIL_FIELDS = [
  COORDINATION_LIST_FIELDS,
  "handoff_reason_summary",
  "minimum_necessary_reason",
  "created_by",
  "updated_by",
  "created_at",
].join(",");

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

function requiredText(value: unknown, minLength: number, maxLength: number) {
  const normalized = cleanText(value, maxLength);
  if (!normalized || normalized.length < minLength) return null;
  return normalized;
}

function optionalUuid(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string" && UUID_PATTERN.test(value)) return value;
  return undefined;
}

function databaseStatus(error: { code?: string } | null) {
  if (!error) return 500;
  if (["22023", "23502", "23503", "23505", "23514"].includes(error.code ?? "")) {
    return 400;
  }
  if (error.code === "42501") return 403;
  return 500;
}

function phaseState() {
  return {
    internalCoordinationMetadataOnly: true,
    substantiveSafetyOrEmergencyStandardApproved: false,
    trustSafetyCaseMutationEnabled: false,
    legalRequestMutationEnabled: false,
    externalReportingEnabled: false,
    externalContactEnabled: false,
    emergencyApprovalEnabled: false,
    disclosureEnabled: false,
    exportEnabled: false,
    externalTransmissionEnabled: false,
    memberNoticeSendingEnabled: false,
  };
}

async function requireSafetyCoordinationCapability(
  service: ServiceClient,
  userId: string,
  canReviewRequests: boolean
) {
  if (!canReviewRequests) {
    return {
      allowed: false as const,
      unavailable: false as const,
      canReviewEmergency: false,
    };
  }

  const capability = await service
    .from("legal_operations_authorizations")
    .select("can_coordinate_safety,can_review_emergency")
    .eq("user_id", userId)
    .maybeSingle();

  if (capability.error) {
    return {
      allowed: false as const,
      unavailable: true as const,
      canReviewEmergency: false,
    };
  }

  return {
    allowed: Boolean(capability.data?.can_coordinate_safety),
    unavailable: false as const,
    canReviewEmergency: Boolean(capability.data?.can_review_emergency),
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
        { error: "Safety coordination was blocked because audit recording failed." },
        { status: 503 }
      );
}

async function loadEligibleSafetyCase(service: ServiceClient, caseId: string) {
  return service
    .from("trust_safety_cases")
    .select(CASE_FIELDS)
    .eq("id", caseId)
    .in("primary_category", SAFETY_CASE_CATEGORIES)
    .maybeSingle();
}

async function legalRequestExists(service: ServiceClient, requestId: string) {
  const result = await service
    .from("legal_requests")
    .select("id")
    .eq("id", requestId)
    .maybeSingle();
  return !result.error && Boolean(result.data);
}

export async function GET(request: NextRequest) {
  const access = await requireLegalOperationsAccess(request);
  if (!access.user) return access.response;

  const { service, user, authorization } = access;
  const capability = await requireSafetyCoordinationCapability(
    service,
    user.id,
    authorization.can_review_requests
  );

  if (capability.unavailable) {
    return NextResponse.json(
      { error: "Safety coordination capability could not be verified." },
      { status: 503 }
    );
  }
  if (!capability.allowed) {
    return NextResponse.json(
      {
        error:
          "Legal Operations capabilities can_review_requests and can_coordinate_safety are required.",
      },
      { status: 403 }
    );
  }

  const caseId = request.nextUrl.searchParams.get("caseId");

  if (!caseId) {
    const auditFailure = await auditOrFail(
      service,
      user.id,
      "legal_safety_coordination_workspace_view_attempt",
      "legal_safety_coordination_workspace",
      null,
      {
        surface: "/admin/legal-operations/safety-coordination",
        foundation_version: "20260809084500",
        mode: "internal_coordination_only",
        substantive_standard_approved: false,
        trust_safety_case_mutation_enabled: false,
        legal_request_mutation_enabled: false,
        external_reporting_enabled: false,
        external_contact_enabled: false,
        emergency_approval_enabled: false,
        disclosure_enabled: false,
        export_enabled: false,
        external_transmission_enabled: false,
      }
    );
    if (auditFailure) return auditFailure;

    const [casesResult, coordinationResult] = await Promise.all([
      service
        .from("trust_safety_cases")
        .select(CASE_FIELDS)
        .in("primary_category", SAFETY_CASE_CATEGORIES)
        .order("updated_at", { ascending: false })
        .limit(250),
      service
        .from("legal_safety_coordination")
        .select(COORDINATION_LIST_FIELDS)
        .order("updated_at", { ascending: false })
        .limit(250),
    ]);

    if (casesResult.error || coordinationResult.error) {
      return NextResponse.json(
        { error: "Unable to load internal safety coordination metadata." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      authorization: {
        role: authorization.role,
        can_review_requests: authorization.can_review_requests,
        can_coordinate_safety: true,
        can_review_emergency: capability.canReviewEmergency,
        can_export: authorization.can_export,
        can_disclose: authorization.can_disclose,
        can_approve_emergency: authorization.can_approve_emergency,
      },
      cases: casesResult.data ?? [],
      coordination: coordinationResult.data ?? [],
      phase: phaseState(),
    });
  }

  if (!UUID_PATTERN.test(caseId)) {
    return NextResponse.json({ error: "Invalid Trust and Safety case identifier." }, { status: 400 });
  }

  const auditFailure = await auditOrFail(
    service,
    user.id,
    "legal_safety_coordination_case_view_attempt",
    "trust_safety_case",
    caseId,
    {
      surface: "/admin/legal-operations/safety-coordination",
      mode: "internal_coordination_only",
    }
  );
  if (auditFailure) return auditFailure;

  const caseResult = await loadEligibleSafetyCase(service, caseId);
  if (caseResult.error) {
    return NextResponse.json(
      { error: "Unable to load Trust and Safety case metadata." },
      { status: 500 }
    );
  }
  if (!caseResult.data) {
    return NextResponse.json(
      { error: "Eligible Trust and Safety case metadata was not found." },
      { status: 404 }
    );
  }

  const coordinationResult = await service
    .from("legal_safety_coordination")
    .select(COORDINATION_DETAIL_FIELDS)
    .eq("trust_safety_case_id", caseId)
    .maybeSingle();

  if (coordinationResult.error) {
    return NextResponse.json(
      { error: "Unable to load internal coordination metadata." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    case: caseResult.data,
    coordination: coordinationResult.data ?? null,
    authorization: {
      can_review_emergency: capability.canReviewEmergency,
    },
    phase: phaseState(),
  });
}

export async function POST(request: NextRequest) {
  const access = await requireLegalOperationsAccess(request);
  if (!access.user) return access.response;

  const { service, user, authorization } = access;
  const capability = await requireSafetyCoordinationCapability(
    service,
    user.id,
    authorization.can_review_requests
  );

  if (capability.unavailable) {
    return NextResponse.json(
      { error: "Safety coordination capability could not be verified." },
      { status: 503 }
    );
  }
  if (!capability.allowed) {
    return NextResponse.json(
      {
        error:
          "Legal Operations capabilities can_review_requests and can_coordinate_safety are required.",
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const operation = cleanText(body.operation, 80);
  if (!operation || !["create_coordination_draft", "update_coordination_draft"].includes(operation)) {
    return NextResponse.json(
      {
        error:
          "Only internal draft safety-coordination metadata operations are enabled. External reporting, contact, approval, disclosure, export, and transmission are disabled.",
      },
      { status: 409 }
    );
  }

  const caseId = cleanText(body.caseId, 80);
  if (!caseId || !UUID_PATTERN.test(caseId)) {
    return NextResponse.json({ error: "Valid caseId is required." }, { status: 400 });
  }

  const caseResult = await loadEligibleSafetyCase(service, caseId);
  if (caseResult.error) {
    return NextResponse.json(
      { error: "Unable to verify Trust and Safety case metadata." },
      { status: 500 }
    );
  }
  if (!caseResult.data) {
    return NextResponse.json(
      { error: "Eligible Trust and Safety case metadata was not found." },
      { status: 404 }
    );
  }

  const coordinationType = cleanText(body.coordinationType, 100);
  const coordinationStatus = cleanText(body.status, 100) ?? "draft";
  const handoffReasonSummary = requiredText(body.handoffReasonSummary, 5, 4000);
  const minimumNecessaryReason = requiredText(body.minimumNecessaryReason, 5, 4000);
  const legalRequestId = optionalUuid(body.legalRequestId);

  if (!coordinationType || !COORDINATION_TYPES.has(coordinationType)) {
    return NextResponse.json({ error: "Invalid coordination type." }, { status: 400 });
  }
  if (!COORDINATION_STATUSES.has(coordinationStatus)) {
    return NextResponse.json({ error: "Invalid coordination status." }, { status: 400 });
  }
  if (!handoffReasonSummary || !minimumNecessaryReason) {
    return NextResponse.json(
      { error: "Handoff reason and minimum-necessary reason are required." },
      { status: 400 }
    );
  }
  if (legalRequestId === undefined) {
    return NextResponse.json({ error: "Invalid Legal Operations request reference." }, { status: 400 });
  }
  if (legalRequestId && !(await legalRequestExists(service, legalRequestId))) {
    return NextResponse.json({ error: "Legal Operations request reference was not found." }, { status: 404 });
  }
  if (coordinationType === "imminent_danger" && !capability.canReviewEmergency) {
    return NextResponse.json(
      { error: "Imminent-danger coordination additionally requires can_review_emergency." },
      { status: 403 }
    );
  }

  if (operation === "create_coordination_draft") {
    const existing = await service
      .from("legal_safety_coordination")
      .select("id")
      .eq("trust_safety_case_id", caseId)
      .maybeSingle();

    if (existing.error) {
      return NextResponse.json(
        { error: "Unable to verify existing coordination metadata." },
        { status: 500 }
      );
    }
    if (existing.data) {
      return NextResponse.json(
        { error: "A coordination record already exists for this Trust and Safety case." },
        { status: 409 }
      );
    }

    const createAuditFailure = await auditOrFail(
      service,
      user.id,
      "legal_safety_coordination_create_attempt",
      "trust_safety_case",
      caseId,
      {
        surface: "/admin/legal-operations/safety-coordination",
        fields: [
          "coordination_type",
          "status",
          "handoff_reason_summary",
          "minimum_necessary_reason",
          "legal_request_id",
        ],
        coordination_type: coordinationType,
        coordination_status: coordinationStatus,
        internal_only: true,
        external_reporting_enabled: false,
        external_contact_enabled: false,
        emergency_approval_enabled: false,
      }
    );
    if (createAuditFailure) return createAuditFailure;

    const result = await service
      .from("legal_safety_coordination")
      .insert({
        trust_safety_case_id: caseId,
        legal_request_id: legalRequestId,
        coordination_type: coordinationType,
        status: coordinationStatus,
        handoff_reason_summary: handoffReasonSummary,
        minimum_necessary_reason: minimumNecessaryReason,
        assigned_legal_reviewer: user.id,
        revision: 0,
        created_by: user.id,
        updated_by: user.id,
      })
      .select(COORDINATION_DETAIL_FIELDS)
      .single();

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: "Unable to create internal safety coordination metadata." },
        { status: databaseStatus(result.error) }
      );
    }

    return NextResponse.json({ coordination: result.data, phase: phaseState() }, { status: 201 });
  }

  const current = await service
    .from("legal_safety_coordination")
    .select("id,revision")
    .eq("trust_safety_case_id", caseId)
    .maybeSingle();

  if (current.error) {
    return NextResponse.json(
      { error: "Unable to load coordination metadata for update." },
      { status: 500 }
    );
  }
  if (!current.data) {
    return NextResponse.json({ error: "Coordination metadata was not found." }, { status: 404 });
  }

  const currentRevision = Number(current.data.revision ?? 0);
  const nextRevision = currentRevision + 1;

  const updateAuditFailure = await auditOrFail(
    service,
    user.id,
    "legal_safety_coordination_update_attempt",
    "legal_safety_coordination",
    current.data.id,
    {
      surface: "/admin/legal-operations/safety-coordination",
      trust_safety_case_id: caseId,
      fields: [
        "coordination_type",
        "status",
        "handoff_reason_summary",
        "minimum_necessary_reason",
        "legal_request_id",
      ],
      coordination_type: coordinationType,
      coordination_status: coordinationStatus,
      from_revision: currentRevision,
      to_revision: nextRevision,
      internal_only: true,
      external_reporting_enabled: false,
      external_contact_enabled: false,
      emergency_approval_enabled: false,
    }
  );
  if (updateAuditFailure) return updateAuditFailure;

  const result = await service
    .from("legal_safety_coordination")
    .update({
      legal_request_id: legalRequestId,
      coordination_type: coordinationType,
      status: coordinationStatus,
      handoff_reason_summary: handoffReasonSummary,
      minimum_necessary_reason: minimumNecessaryReason,
      assigned_legal_reviewer: user.id,
      revision: nextRevision,
      updated_by: user.id,
    })
    .eq("id", current.data.id)
    .eq("revision", currentRevision)
    .select(COORDINATION_DETAIL_FIELDS)
    .maybeSingle();

  if (result.error) {
    return NextResponse.json(
      { error: "Unable to update internal safety coordination metadata." },
      { status: databaseStatus(result.error) }
    );
  }
  if (!result.data) {
    return NextResponse.json(
      { error: "The coordination draft changed concurrently. Reload and try again." },
      { status: 409 }
    );
  }

  return NextResponse.json({ coordination: result.data, phase: phaseState() });
}
