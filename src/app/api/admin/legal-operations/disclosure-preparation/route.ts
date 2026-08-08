import { NextRequest, NextResponse } from "next/server";
import {
  recordLegalOperationsAudit,
  requireLegalOperationsAccess,
} from "@/lib/legal-operations/access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DISCLOSURE_TYPES = new Set([
  "ordinary",
  "emergency",
  "preservation_ack",
  "ip_response",
  "regulatory",
  "other",
]);

const BLOCKED_OPERATIONS = new Set([
  "approve_disclosure",
  "approve_emergency_disclosure",
  "submit_disclosure_for_approval",
  "generate_export",
  "generate_export_package",
  "export_request_data",
  "finalize_manifest",
  "set_manifest_hash",
  "send_member_notice",
  "transmit_disclosure",
  "send_disclosure",
  "external_transmission",
]);

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

function databaseStatus(error: { code?: string } | null) {
  if (!error) return 500;
  if (["22023", "23502", "23503", "23505", "23514"].includes(error.code ?? "")) return 400;
  if (error.code === "42501") return 409;
  return 500;
}

function phaseState() {
  return {
    disclosurePreparationEnabled: true,
    exportGenerationEnabled: false,
    disclosureApprovalEnabled: false,
    emergencyApprovalEnabled: false,
    memberNoticeSendingEnabled: false,
    externalTransmissionEnabled: false,
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
    targetId,
    metadata,
  });

  return recorded
    ? null
    : NextResponse.json(
        { error: "Disclosure preparation was blocked because audit recording failed." },
        { status: 503 }
      );
}

async function requestExists(service: ServiceClient, requestId: string) {
  const result = await service
    .from("legal_requests")
    .select(
      "id,request_number,request_type,status,received_at,original_scope,narrowed_scope,requester_identity_status,authority_review_status,scope_review_status,counsel_review_status,cross_border_status"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (result.error) return { row: null, failed: true };
  return { row: result.data, failed: false };
}

function cleanFieldNames(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null;

  const fields = value.map((entry) => cleanText(entry, 200));
  if (fields.some((entry) => !entry)) return null;

  const normalized = Array.from(new Set(fields as string[]));
  if (
    normalized.some((entry) =>
      ["*", "all", "all_fields", "all fields"].includes(entry.toLowerCase())
    )
  ) {
    return null;
  }

  return normalized;
}

export async function GET(request: NextRequest) {
  const access = await requireLegalOperationsAccess(request, "can_export");
  if (!access.user) return access.response;

  const { service, user, authorization } = access;
  const requestId = request.nextUrl.searchParams.get("requestId");

  if (!requestId) {
    const auditFailure = await auditOrFail(
      service,
      user.id,
      "legal_disclosure_preparation_workspace_view_attempt",
      "legal_disclosure_preparation_workspace",
      null,
      { surface: "/admin/legal-operations/disclosure-preparation" }
    );
    if (auditFailure) return auditFailure;

    const result = await service
      .from("legal_requests")
      .select(
        "id,request_number,request_type,status,received_at,original_scope,narrowed_scope,requester_identity_status,authority_review_status,scope_review_status,counsel_review_status,cross_border_status"
      )
      .order("updated_at", { ascending: false })
      .limit(250);

    if (result.error) {
      return NextResponse.json({ error: "Unable to load legal requests for disclosure preparation." }, { status: 500 });
    }

    return NextResponse.json({
      authorization,
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
    "legal_disclosure_preparation_request_view_attempt",
    "legal_request",
    requestId,
    { surface: "/admin/legal-operations/disclosure-preparation" }
  );
  if (auditFailure) return auditFailure;

  const requestResult = await requestExists(service, requestId);
  if (requestResult.failed) {
    return NextResponse.json({ error: "Unable to load the legal request." }, { status: 500 });
  }
  if (!requestResult.row) {
    return NextResponse.json({ error: "Legal request not found." }, { status: 404 });
  }

  const disclosureResult = await service
    .from("legal_disclosures")
    .select(
      "id,request_id,disclosure_type,status,legal_basis_summary,scope_summary,recipient_organization,recipient_contact_ref,member_notice_decision,delayed_notice_basis,manifest_sha256,approved_by,approved_at,transmitted_by,transmitted_at,created_by,updated_by,created_at,updated_at"
    )
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (disclosureResult.error) {
    return NextResponse.json({ error: "Unable to load disclosure preparation metadata." }, { status: 500 });
  }

  const disclosureIds = (disclosureResult.data ?? []).map((row) => row.id as string);
  let items: unknown[] = [];
  if (disclosureIds.length > 0) {
    const itemResult = await service
      .from("legal_disclosure_items")
      .select(
        "id,disclosure_id,resource_key,source_system,record_ref,field_names,object_count,file_name,sha256,minimum_necessary_justification,created_by,created_at"
      )
      .in("disclosure_id", disclosureIds)
      .order("created_at", { ascending: true });

    if (itemResult.error) {
      return NextResponse.json({ error: "Unable to load disclosure manifest metadata." }, { status: 500 });
    }
    items = itemResult.data ?? [];
  }

  const accessEvent = await service.from("legal_request_events").insert({
    request_id: requestId,
    event_type: "access",
    action: "legal_disclosure_preparation_viewed",
    purpose: "Authorized review of draft disclosure preparation metadata.",
    details: { surface: "/admin/legal-operations/disclosure-preparation" },
    actor_id: user.id,
  });

  if (accessEvent.error) {
    return NextResponse.json(
      { error: "Disclosure preparation could not be opened because access auditing failed." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    authorization,
    request: requestResult.row,
    disclosures: disclosureResult.data ?? [],
    items,
    phase: phaseState(),
  });
}

export async function POST(request: NextRequest) {
  const access = await requireLegalOperationsAccess(request, "can_export");
  if (!access.user) return access.response;

  const { service, user } = access;
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const operation = cleanText(body.operation, 100);
  if (!operation) {
    return NextResponse.json({ error: "Operation is required." }, { status: 400 });
  }

  if (BLOCKED_OPERATIONS.has(operation)) {
    return NextResponse.json(
      {
        error:
          "Export generation, disclosure approval, emergency approval, member notice sending, and external transmission remain disabled.",
      },
      { status: 409 }
    );
  }

  if (!["create_draft_disclosure", "update_draft_disclosure", "add_manifest_item"].includes(operation)) {
    return NextResponse.json({ error: "Unsupported disclosure preparation operation." }, { status: 400 });
  }

  const requestId = cleanText(body.requestId, 80);
  if (!requestId || !UUID_PATTERN.test(requestId)) {
    return NextResponse.json({ error: "Valid requestId is required." }, { status: 400 });
  }

  const existingRequest = await requestExists(service, requestId);
  if (existingRequest.failed) {
    return NextResponse.json({ error: "Unable to verify the legal request." }, { status: 500 });
  }
  if (!existingRequest.row) {
    return NextResponse.json({ error: "Legal request not found." }, { status: 404 });
  }

  if (operation === "create_draft_disclosure" || operation === "update_draft_disclosure") {
    const disclosureType = cleanText(body.disclosureType, 100) ?? "ordinary";
    const legalBasisSummary = requiredText(body.legalBasisSummary, 5, 12000);
    const scopeSummary = requiredText(body.scopeSummary, 5, 20000);
    const recipientOrganization = requiredText(body.recipientOrganization, 2, 1000);
    const recipientContactRef = cleanText(body.recipientContactRef, 1000);
    const memberNoticeDecision = cleanText(body.memberNoticeDecision, 8000);
    const delayedNoticeBasis = cleanText(body.delayedNoticeBasis, 8000);

    if (
      !DISCLOSURE_TYPES.has(disclosureType) ||
      !legalBasisSummary ||
      !scopeSummary ||
      !recipientOrganization
    ) {
      return NextResponse.json({ error: "Draft disclosure metadata is invalid." }, { status: 400 });
    }

    const disclosureId = cleanText(body.disclosureId, 80);
    if (
      operation === "update_draft_disclosure" &&
      (!disclosureId || !UUID_PATTERN.test(disclosureId))
    ) {
      return NextResponse.json({ error: "Valid disclosureId is required." }, { status: 400 });
    }

    const auditFailure = await auditOrFail(
      service,
      user.id,
      operation === "create_draft_disclosure"
        ? "legal_disclosure_draft_create_attempt"
        : "legal_disclosure_draft_update_attempt",
      "legal_request",
      requestId,
      {
        disclosure_id: disclosureId ?? null,
        disclosure_type: disclosureType,
        preparation_only: true,
      }
    );
    if (auditFailure) return auditFailure;

    const rpcName =
      operation === "create_draft_disclosure"
        ? "legal_create_disclosure_draft"
        : "legal_update_disclosure_draft";

    const params: Record<string, unknown> = {
      p_request_id: requestId,
      p_disclosure_type: disclosureType,
      p_legal_basis_summary: legalBasisSummary,
      p_scope_summary: scopeSummary,
      p_recipient_organization: recipientOrganization,
      p_recipient_contact_ref: recipientContactRef,
      p_member_notice_decision: memberNoticeDecision,
      p_delayed_notice_basis: delayedNoticeBasis,
      p_actor_id: user.id,
    };
    if (disclosureId) params.p_disclosure_id = disclosureId;

    const result = await service.rpc(rpcName, params);
    if (result.error) {
      return NextResponse.json(
        {
          error:
            operation === "create_draft_disclosure"
              ? "Unable to create the disclosure draft."
              : "Unable to update the disclosure draft.",
        },
        { status: databaseStatus(result.error) }
      );
    }

    return NextResponse.json(
      { disclosure: result.data, phase: phaseState() },
      { status: operation === "create_draft_disclosure" ? 201 : 200 }
    );
  }

  const disclosureId = cleanText(body.disclosureId, 80);
  const resourceKey = cleanText(body.resourceKey, 200);
  const sourceSystem = requiredText(body.sourceSystem, 2, 500);
  const recordRef = cleanText(body.recordRef, 2000);
  const fieldNames = cleanFieldNames(body.fieldNames);
  const minimumNecessaryJustification = requiredText(
    body.minimumNecessaryJustification,
    5,
    4000
  );

  if (
    !disclosureId ||
    !UUID_PATTERN.test(disclosureId) ||
    !sourceSystem ||
    !fieldNames ||
    !minimumNecessaryJustification ||
    (!resourceKey && !recordRef)
  ) {
    return NextResponse.json({ error: "Least-data manifest item is invalid." }, { status: 400 });
  }

  const auditFailure = await auditOrFail(
    service,
    user.id,
    "legal_disclosure_manifest_item_add_attempt",
    "legal_disclosure",
    disclosureId,
    {
      request_id: requestId,
      resource_key: resourceKey,
      source_system: sourceSystem,
      field_count: fieldNames.length,
      preparation_only: true,
    }
  );
  if (auditFailure) return auditFailure;

  const result = await service.rpc("legal_add_disclosure_manifest_item", {
    p_request_id: requestId,
    p_disclosure_id: disclosureId,
    p_resource_key: resourceKey,
    p_source_system: sourceSystem,
    p_record_ref: recordRef,
    p_field_names: fieldNames,
    p_minimum_necessary_justification: minimumNecessaryJustification,
    p_actor_id: user.id,
  });

  if (result.error) {
    return NextResponse.json(
      { error: "Unable to add the least-data manifest item." },
      { status: databaseStatus(result.error) }
    );
  }

  return NextResponse.json({ item: result.data, phase: phaseState() }, { status: 201 });
}
