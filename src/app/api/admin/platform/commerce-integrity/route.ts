import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

const TAXONOMY_VERSION = "commerce_integrity.v1";

const SOURCE_MODULES = {
  marketplace: {
    recordType: "marketplace_listing",
    reportType: "marketplace_report",
  },
  businesses: {
    recordType: "business",
    reportType: "business_report",
  },
  services: {
    recordType: "provider_service",
    reportType: "service_report",
  },
  requests: {
    recordType: "service_request",
    reportType: "request_report",
  },
  jobs: {
    recordType: "job_posting",
    reportType: "job_report",
  },
  events: {
    recordType: "public_event",
    reportType: "event_report",
  },
  appointments: {
    recordType: "appointment_request",
    reportType: null,
  },
} as const;

type SourceModule = keyof typeof SOURCE_MODULES;
type JsonObject = Record<string, unknown>;

class CommerceIntegrityAdminError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "commerce_integrity_admin_error",
  ) {
    super(message);
  }
}

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof CommerceIntegrityAdminError) {
    return response({ error: error.message, code: error.code }, error.status);
  }

  console.error("Commerce integrity administrator request failed:", error);
  return response(
    {
      error: "Commerce integrity review could not complete this request.",
      code: "commerce_integrity_admin_failed",
    },
    500,
  );
}

function text(value: unknown, maximum = 6000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function sourceModule(value: unknown): SourceModule | null {
  if (typeof value !== "string") return null;
  return Object.prototype.hasOwnProperty.call(SOURCE_MODULES, value)
    ? (value as SourceModule)
    : null;
}

function stringArray(value: unknown, maximum = 20) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maximum);
}

async function requireAdministrator(request: NextRequest) {
  const access = await verifyRequestAccountAccess(createRequestSupabase(request));

  if (!access.ok) {
    throw new CommerceIntegrityAdminError(
      access.error,
      access.status,
      access.code ?? "account_access_denied",
    );
  }

  if (access.profile.is_admin !== true) {
    throw new CommerceIntegrityAdminError(
      "Administrator access is required.",
      403,
      "administrator_required",
    );
  }

  return {
    administratorId: access.user.id,
    service: createRoomServiceSupabase(),
  };
}

function rpcFailureStatus(code: string | undefined) {
  if (code === "42501") return 403;
  if (code === "P0002") return 404;
  if (code === "23505" || code === "40001") return 409;
  return 400;
}

export async function GET(request: NextRequest) {
  try {
    const { service } = await requireAdministrator(request);
    const moduleKey = sourceModule(request.nextUrl.searchParams.get("module"));
    const recordId = request.nextUrl.searchParams.get("recordId");

    if (!moduleKey) {
      throw new CommerceIntegrityAdminError(
        "A supported commerce source module is required.",
        400,
        "unsupported_source_module",
      );
    }

    if (!validUuid(recordId)) {
      throw new CommerceIntegrityAdminError(
        "A valid source record id is required.",
        400,
        "invalid_source_record_id",
      );
    }

    const contract = SOURCE_MODULES[moduleKey];
    const historyResult = await service
      .from("commerce_integrity_classifications")
      .select(
        "id,taxonomy_version,source_module,source_record_type,source_record_id,source_report_type,source_report_id,commerce_category_id,primary_safety_reason_code,secondary_safety_reason_codes,context_modifiers,policy_severity_code,triage_severity_code,record_state,classification_source,basis_note,classified_by,classified_at,supersedes_classification_id,enforcement_decision_id,trust_safety_case_id,created_at",
      )
      .eq("taxonomy_family", "commerce_integrity")
      .eq("source_module", moduleKey)
      .eq("source_record_type", contract.recordType)
      .eq("source_record_id", recordId)
      .order("classified_at", { ascending: false })
      .limit(200);

    if (historyResult.error) {
      throw new CommerceIntegrityAdminError(
        historyResult.error.message || "Unable to load classification history.",
        503,
        "classification_history_unavailable",
      );
    }

    const history = (historyResult.data ?? []) as unknown as JsonObject[];
    const supersededIds = new Set(
      history
        .map((row) => text(row.supersedes_classification_id, 80))
        .filter(Boolean),
    );
    const currentHeads = history.filter(
      (row) => !supersededIds.has(text(row.id, 80)),
    );

    if (currentHeads.length > 1) {
      throw new CommerceIntegrityAdminError(
        "Classification history contains more than one current head and requires engineering review.",
        409,
        "classification_history_forked",
      );
    }

    return response({
      isAdmin: true,
      taxonomyVersion: TAXONOMY_VERSION,
      module: moduleKey,
      sourceRecordType: contract.recordType,
      sourceReportType: contract.reportType,
      currentHead: currentHeads[0] ?? null,
      history,
      boundaries: {
        automatedClassification: false,
        enforcementSideEffect: false,
        reportResolutionSideEffect: false,
        memberNoticeSideEffect: false,
        externalActionSideEffect: false,
        roomsWriteEnabled: false,
        messagesWriteEnabled: false,
        localWriteEnabled: false,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { administratorId, service } = await requireAdministrator(request);
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new CommerceIntegrityAdminError(
        "Invalid commerce integrity review request.",
        400,
        "invalid_payload",
      );
    }

    const input = body as JsonObject;
    const moduleKey = sourceModule(input.module);
    const sourceRecordId = text(input.sourceRecordId, 80);
    const sourceReportId = text(input.sourceReportId, 80);
    const categoryId = text(input.categoryId, 40);
    const primarySafetyReasonCode = text(input.primarySafetyReasonCode, 180);
    const secondarySafetyReasonCodes = stringArray(
      input.secondarySafetyReasonCodes,
    );
    const policySeverityCode = text(input.policySeverityCode, 40);
    const recordState = text(input.recordState, 40);
    const basisNote = text(input.basisNote, 6000);
    const supersedesClassificationId = text(
      input.supersedesClassificationId,
      80,
    );
    const trustSafetyCaseId = text(input.trustSafetyCaseId, 80);

    if (!moduleKey) {
      throw new CommerceIntegrityAdminError(
        "A supported commerce source module is required.",
        400,
        "unsupported_source_module",
      );
    }

    if (!validUuid(sourceRecordId)) {
      throw new CommerceIntegrityAdminError(
        "A valid source record id is required.",
        400,
        "invalid_source_record_id",
      );
    }

    const contract = SOURCE_MODULES[moduleKey];

    if (sourceReportId && !contract.reportType) {
      throw new CommerceIntegrityAdminError(
        "This source module does not accept a report id for commerce classification.",
        400,
        "source_report_not_supported",
      );
    }

    if (sourceReportId && !validUuid(sourceReportId)) {
      throw new CommerceIntegrityAdminError(
        "The source report id is invalid.",
        400,
        "invalid_source_report_id",
      );
    }

    if (!/^COM-(0[1-9]|1[0-5])$/.test(categoryId)) {
      throw new CommerceIntegrityAdminError(
        "A canonical COM-01 through COM-15 category is required.",
        400,
        "invalid_category_id",
      );
    }

    if (!primarySafetyReasonCode) {
      throw new CommerceIntegrityAdminError(
        "A canonical primary safety reason is required.",
        400,
        "primary_reason_required",
      );
    }

    if (!(["proposed", "confirmed"] as const).includes(recordState as "proposed" | "confirmed")) {
      throw new CommerceIntegrityAdminError(
        "Manual reviewer classifications must be proposed or confirmed.",
        400,
        "invalid_record_state",
      );
    }

    if (basisNote.length < 5) {
      throw new CommerceIntegrityAdminError(
        "A classification basis note of at least five characters is required.",
        400,
        "basis_note_required",
      );
    }

    if (policySeverityCode && !/^POLICY\.S[0-5]$/.test(policySeverityCode)) {
      throw new CommerceIntegrityAdminError(
        "Policy severity must use POLICY.S0 through POLICY.S5.",
        400,
        "invalid_policy_severity",
      );
    }

    if (supersedesClassificationId && !validUuid(supersedesClassificationId)) {
      throw new CommerceIntegrityAdminError(
        "The superseded classification id is invalid.",
        400,
        "invalid_supersession_id",
      );
    }

    if (trustSafetyCaseId && !validUuid(trustSafetyCaseId)) {
      throw new CommerceIntegrityAdminError(
        "The Trust and Safety case id is invalid.",
        400,
        "invalid_trust_safety_case_id",
      );
    }

    const rpcResult = await service.rpc("create_commerce_integrity_classification", {
      p_actor_user_id: administratorId,
      p_taxonomy_version: TAXONOMY_VERSION,
      p_source_module: moduleKey,
      p_source_record_type: contract.recordType,
      p_source_record_id: sourceRecordId,
      p_commerce_category_id: categoryId,
      p_primary_safety_reason_code: primarySafetyReasonCode,
      p_basis_note: basisNote,
      p_secondary_safety_reason_codes: secondarySafetyReasonCodes,
      p_context_modifiers: [],
      p_policy_severity_code: policySeverityCode || null,
      p_triage_severity_code: null,
      p_record_state: recordState,
      p_classification_source: "human_review",
      p_source_report_type: sourceReportId ? contract.reportType : null,
      p_source_report_id: sourceReportId || null,
      p_supersedes_classification_id: supersedesClassificationId || null,
      p_enforcement_decision_id: null,
      p_trust_safety_case_id: trustSafetyCaseId || null,
    });

    if (rpcResult.error) {
      throw new CommerceIntegrityAdminError(
        rpcResult.error.message || "Unable to create the classification.",
        rpcFailureStatus(rpcResult.error.code),
        `classification_rpc_${rpcResult.error.code ?? "failed"}`,
      );
    }

    if (!validUuid(rpcResult.data)) {
      throw new CommerceIntegrityAdminError(
        "The classification service returned an invalid identifier.",
        503,
        "classification_identifier_invalid",
      );
    }

    return response(
      {
        created: true,
        classificationId: rpcResult.data,
        taxonomyVersion: TAXONOMY_VERSION,
        module: moduleKey,
        sourceRecordType: contract.recordType,
        sourceReportType: sourceReportId ? contract.reportType : null,
        recordState,
      },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
