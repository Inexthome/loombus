import { NextRequest, NextResponse } from "next/server";
import {
  recordLegalOperationsAudit,
  requireLegalOperationsAccess,
  type LegalOperationsAuthorization,
  type LegalOperationsCapability,
} from "@/lib/legal-operations/access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TYPES = new Set([
  "subpoena",
  "warrant",
  "court_order",
  "preservation_request",
  "emergency_disclosure",
  "ip_notice",
  "regulatory_request",
  "law_enforcement_inquiry",
  "civil_request",
  "other",
]);
const INTAKE_CHANNELS = new Set([
  "legal_email",
  "mail",
  "service",
  "portal",
  "internal_referral",
  "other",
]);
const PHASE_TWO_REQUEST_STATUSES = new Set([
  "intake",
  "identity_verification",
  "authority_review",
  "scope_review",
  "awaiting_counsel",
  "preservation_active",
  "deficient",
  "rejected",
  "closed",
]);
const IDENTITY_STATUSES = new Set([
  "unverified",
  "pending",
  "verified",
  "failed",
  "not_applicable",
]);
const AUTHORITY_STATUSES = new Set([
  "unreviewed",
  "pending",
  "sufficient",
  "insufficient",
  "requires_counsel",
]);
const SCOPE_STATUSES = new Set([
  "unreviewed",
  "pending",
  "accepted",
  "narrowed",
  "deficient",
  "rejected",
]);
const CROSS_BORDER_STATUSES = new Set([
  "not_identified",
  "not_applicable",
  "identified",
  "requires_counsel",
  "resolved",
]);
const HOLD_TARGET_TYPES = new Set([
  "account",
  "profile",
  "discussion",
  "reply",
  "private_message",
  "room",
  "storage_object",
  "billing_record",
  "support_record",
  "search_document",
  "ai_record",
  "trust_safety_case",
  "audit_log",
  "notification_delivery",
  "vendor_record",
  "other",
]);
const MANUAL_EVENT_TYPES = new Set(["handling", "note", "specialist_routing"]);

const PHASE_TWO_BLOCKED_OPERATIONS = new Set([
  "create_disclosure",
  "update_disclosure",
  "approve_disclosure",
  "transmit_disclosure",
  "add_disclosure_item",
  "export_request_data",
  "generate_export",
  "send_disclosure",
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

function hasOwn(value: JsonObject, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
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

function nullableUuid(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string" && UUID_PATTERN.test(value)) return value;
  return undefined;
}

function cleanTimestamp(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function safeObject(value: unknown, maxBytes = 20000): JsonObject | null {
  if (!isRecord(value)) return null;
  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).length > maxBytes) return null;
  return value;
}

function hasCapability(
  authorization: LegalOperationsAuthorization,
  capability: LegalOperationsCapability
) {
  return Boolean(authorization[capability]);
}

function capabilityResponse(capability: LegalOperationsCapability) {
  return NextResponse.json(
    { error: `Legal Operations capability ${capability} is required.` },
    { status: 403 }
  );
}

function databaseStatus(error: { code?: string } | null) {
  if (!error) return 500;
  if (["22023", "23502", "23503", "23505", "23514"].includes(error.code ?? "")) {
    return 400;
  }
  if (error.code === "42501") return 403;
  return 500;
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
        { error: "Legal Operations action was blocked because audit recording failed." },
        { status: 503 }
      );
}

async function requestExists(service: ServiceClient, requestId: string) {
  const result = await service
    .from("legal_requests")
    .select("id,status")
    .eq("id", requestId)
    .maybeSingle();
  return result.error ? null : result.data;
}

async function holdForRequest(service: ServiceClient, requestId: string, holdId: string) {
  const result = await service
    .from("legal_preservation_holds")
    .select("*")
    .eq("id", holdId)
    .eq("request_id", requestId)
    .maybeSingle();
  return result.error ? null : result.data;
}

export async function GET(request: NextRequest) {
  const access = await requireLegalOperationsAccess(request);
  if (!access.user) return access.response;

  const { service, user, authorization } = access;
  const searchParams = request.nextUrl.searchParams;
  const requestId = searchParams.get("requestId");

  if (requestId) {
    if (!UUID_PATTERN.test(requestId)) {
      return NextResponse.json({ error: "Invalid legal-request identifier." }, { status: 400 });
    }

    const auditFailure = await auditOrFail(
      service,
      user.id,
      "legal_operations_request_view_attempt",
      "legal_request",
      requestId,
      { surface: "/admin/legal-operations" }
    );
    if (auditFailure) return auditFailure;

    const requestResult = await service
      .from("legal_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (requestResult.error) {
      return NextResponse.json({ error: "Unable to load the legal request." }, { status: 500 });
    }
    if (!requestResult.data) {
      return NextResponse.json({ error: "Legal request not found." }, { status: 404 });
    }

    const accessEvent = await service.from("legal_request_events").insert({
      request_id: requestId,
      event_type: "access",
      action: "legal_request_viewed",
      purpose: "Authorized Legal Operations review.",
      details: { surface: "/admin/legal-operations" },
      actor_id: user.id,
    });
    if (accessEvent.error) {
      return NextResponse.json(
        { error: "The legal request could not be opened because access auditing failed." },
        { status: 503 }
      );
    }

    const [holdsResult, eventsResult] = await Promise.all([
      service
        .from("legal_preservation_holds")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true }),
      service
        .from("legal_request_events")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false })
        .limit(400),
    ]);

    if (holdsResult.error || eventsResult.error) {
      return NextResponse.json(
        { error: "Unable to load preservation or handling history." },
        { status: 500 }
      );
    }

    const holdIds = (holdsResult.data ?? []).map((hold) => hold.id as string);
    let targets: unknown[] = [];
    if (holdIds.length > 0) {
      const targetResult = await service
        .from("legal_preservation_hold_targets")
        .select("*")
        .in("hold_id", holdIds)
        .order("created_at", { ascending: true });
      if (targetResult.error) {
        return NextResponse.json(
          { error: "Unable to load preservation targets." },
          { status: 500 }
        );
      }
      targets = targetResult.data ?? [];
    }

    return NextResponse.json({
      authorization,
      request: requestResult.data,
      holds: holdsResult.data ?? [],
      targets,
      events: eventsResult.data ?? [],
      phase: {
        disclosureControlsEnabled: false,
        exportEnabled: false,
        externalTransmissionEnabled: false,
      },
    });
  }

  const status = searchParams.get("status");
  const requestType = searchParams.get("requestType");
  if (status && !PHASE_TWO_REQUEST_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
  }
  if (requestType && !REQUEST_TYPES.has(requestType)) {
    return NextResponse.json({ error: "Invalid request-type filter." }, { status: 400 });
  }

  const auditFailure = await auditOrFail(
    service,
    user.id,
    "legal_operations_workspace_view_attempt",
    "legal_operations_workspace",
    null,
    { status_filter: status, request_type_filter: requestType }
  );
  if (auditFailure) return auditFailure;

  let query = service
    .from("legal_requests")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(250);

  if (status) query = query.eq("status", status);
  if (requestType) query = query.eq("request_type", requestType);

  const result = await query;
  if (result.error) {
    return NextResponse.json({ error: "Unable to load legal requests." }, { status: 500 });
  }

  return NextResponse.json({
    authorization,
    requests: result.data ?? [],
    phase: {
      disclosureControlsEnabled: false,
      exportEnabled: false,
      externalTransmissionEnabled: false,
    },
  });
}

export async function POST(request: NextRequest) {
  const access = await requireLegalOperationsAccess(request);
  if (!access.user) return access.response;

  const { service, user, authorization } = access;
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const operation = cleanText(body.operation, 80);
  if (!operation) {
    return NextResponse.json({ error: "Operation is required." }, { status: 400 });
  }

  if (PHASE_TWO_BLOCKED_OPERATIONS.has(operation)) {
    return NextResponse.json(
      {
        error:
          "Disclosure, export, approval, and external transmission operations are not enabled in this phase.",
      },
      { status: 409 }
    );
  }

  if (operation === "create_request") {
    if (!hasCapability(authorization, "can_intake")) return capabilityResponse("can_intake");

    const requestType = cleanText(body.requestType, 100) ?? "other";
    const intakeChannel = cleanText(body.intakeChannel, 100) ?? "legal_email";
    const originalScope = requiredText(body.originalScope, 5, 20000);
    const requesterOrganization = cleanText(body.requesterOrganization, 500);
    const requesterName = cleanText(body.requesterName, 500);
    const requesterContactRef = cleanText(body.requesterContactRef, 1000);
    const jurisdiction = cleanText(body.jurisdiction, 1000);
    const assertedAuthority = cleanText(body.assertedAuthority, 12000);

    if (!REQUEST_TYPES.has(requestType) || !INTAKE_CHANNELS.has(intakeChannel) || !originalScope) {
      return NextResponse.json(
        { error: "Request type, intake channel, or original scope is invalid." },
        { status: 400 }
      );
    }

    const auditFailure = await auditOrFail(
      service,
      user.id,
      "legal_request_create_attempt",
      "legal_request",
      null,
      { request_type: requestType, intake_channel: intakeChannel }
    );
    if (auditFailure) return auditFailure;

    const result = await service
      .from("legal_requests")
      .insert({
        request_type: requestType,
        intake_channel: intakeChannel,
        original_scope: originalScope,
        requester_organization: requesterOrganization,
        requester_name: requesterName,
        requester_contact_ref: requesterContactRef,
        jurisdiction,
        asserted_authority: assertedAuthority,
        assigned_to: user.id,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("*")
      .single();

    if (result.error) {
      return NextResponse.json(
        { error: "Unable to create the legal-request record." },
        { status: databaseStatus(result.error) }
      );
    }

    return NextResponse.json({ request: result.data }, { status: 201 });
  }

  const requestId = cleanText(body.requestId, 80);
  if (!requestId || !UUID_PATTERN.test(requestId)) {
    return NextResponse.json({ error: "Valid requestId is required." }, { status: 400 });
  }

  const existingRequest = await requestExists(service, requestId);
  if (!existingRequest) {
    return NextResponse.json({ error: "Legal request not found." }, { status: 404 });
  }

  if (operation === "update_request") {
    if (!hasCapability(authorization, "can_intake")) return capabilityResponse("can_intake");

    const patch: Record<string, unknown> = { updated_by: user.id };
    if (hasOwn(body, "status")) {
      const value = cleanText(body.status, 100);
      if (!value || !PHASE_TWO_REQUEST_STATUSES.has(value)) {
        return NextResponse.json(
          { error: "That request status is not enabled in this phase." },
          { status: 400 }
        );
      }
      patch.status = value;
    }
    if (hasOwn(body, "requesterIdentityStatus")) {
      const value = cleanText(body.requesterIdentityStatus, 100);
      if (!value || !IDENTITY_STATUSES.has(value)) {
        return NextResponse.json({ error: "Invalid identity-review status." }, { status: 400 });
      }
      patch.requester_identity_status = value;
    }
    if (hasOwn(body, "authorityReviewStatus")) {
      const value = cleanText(body.authorityReviewStatus, 100);
      if (!value || !AUTHORITY_STATUSES.has(value)) {
        return NextResponse.json({ error: "Invalid authority-review status." }, { status: 400 });
      }
      patch.authority_review_status = value;
    }
    if (hasOwn(body, "scopeReviewStatus")) {
      const value = cleanText(body.scopeReviewStatus, 100);
      if (!value || !SCOPE_STATUSES.has(value)) {
        return NextResponse.json({ error: "Invalid scope-review status." }, { status: 400 });
      }
      patch.scope_review_status = value;
    }
    if (hasOwn(body, "crossBorderStatus")) {
      const value = cleanText(body.crossBorderStatus, 100);
      if (!value || !CROSS_BORDER_STATUSES.has(value)) {
        return NextResponse.json({ error: "Invalid cross-border status." }, { status: 400 });
      }
      patch.cross_border_status = value;
    }

    const textFields: Array<[string, string, number]> = [
      ["requesterIdentitySummary", "requester_identity_summary", 8000],
      ["authorityReviewSummary", "authority_review_summary", 12000],
      ["narrowedScope", "narrowed_scope", 20000],
      ["deficiencyReason", "deficiency_reason", 12000],
      ["rejectionReason", "rejection_reason", 12000],
      ["emergencyCriteriaSummary", "emergency_criteria_summary", 12000],
      ["conflictingLawSummary", "conflicting_law_summary", 12000],
      ["confidentialityNotes", "confidentiality_notes", 12000],
      ["memberNoticeDecision", "member_notice_decision", 8000],
      ["delayedNoticeBasis", "delayed_notice_basis", 8000],
    ];
    for (const [inputKey, column, maxLength] of textFields) {
      if (hasOwn(body, inputKey)) patch[column] = cleanText(body[inputKey], maxLength);
    }

    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ error: "No supported request fields were supplied." }, { status: 400 });
    }

    const auditFailure = await auditOrFail(
      service,
      user.id,
      "legal_request_update_attempt",
      "legal_request",
      requestId,
      { fields: Object.keys(patch).filter((key) => key !== "updated_by") }
    );
    if (auditFailure) return auditFailure;

    const result = await service
      .from("legal_requests")
      .update(patch)
      .eq("id", requestId)
      .select("*")
      .single();

    if (result.error) {
      return NextResponse.json(
        { error: "Unable to update the legal request." },
        { status: databaseStatus(result.error) }
      );
    }
    return NextResponse.json({ request: result.data });
  }

  if (operation === "create_hold") {
    if (!hasCapability(authorization, "can_preserve")) return capabilityResponse("can_preserve");

    const legalBasisSummary = requiredText(body.legalBasisSummary, 5, 12000);
    const scopeSummary = requiredText(body.scopeSummary, 5, 20000);
    const expiresAt = cleanTimestamp(body.expiresAt);
    const nextReviewAt = cleanTimestamp(body.nextReviewAt);
    if (!legalBasisSummary || !scopeSummary || expiresAt === undefined || nextReviewAt === undefined) {
      return NextResponse.json({ error: "Preservation-hold fields are invalid." }, { status: 400 });
    }

    const auditFailure = await auditOrFail(
      service,
      user.id,
      "preservation_hold_create_attempt",
      "legal_request",
      requestId
    );
    if (auditFailure) return auditFailure;

    const result = await service
      .from("legal_preservation_holds")
      .insert({
        request_id: requestId,
        status: "draft",
        legal_basis_summary: legalBasisSummary,
        scope_summary: scopeSummary,
        expires_at: expiresAt,
        next_review_at: nextReviewAt,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("*")
      .single();

    if (result.error) {
      return NextResponse.json(
        { error: "Unable to create the draft preservation hold." },
        { status: databaseStatus(result.error) }
      );
    }
    return NextResponse.json({ hold: result.data }, { status: 201 });
  }

  if (operation === "add_hold_target") {
    if (!hasCapability(authorization, "can_preserve")) return capabilityResponse("can_preserve");

    const holdId = cleanText(body.holdId, 80);
    if (!holdId || !UUID_PATTERN.test(holdId)) {
      return NextResponse.json({ error: "Valid holdId is required." }, { status: 400 });
    }
    const hold = await holdForRequest(service, requestId, holdId);
    if (!hold) return NextResponse.json({ error: "Preservation hold not found." }, { status: 404 });
    if (hold.status !== "draft") {
      return NextResponse.json(
        { error: "Targets may only be added while the preservation hold is in draft." },
        { status: 409 }
      );
    }

    const targetType = cleanText(body.targetType, 100);
    const resourceKey = cleanText(body.resourceKey, 200);
    const targetRef = cleanText(body.targetRef, 2000);
    const subjectUserId = nullableUuid(body.subjectUserId);
    const sourceSystem = cleanText(body.sourceSystem, 500);
    const minimumNecessaryReason = requiredText(body.minimumNecessaryReason, 5, 4000);
    const metadata = safeObject(body.metadata ?? {});
    if (
      !targetType ||
      !HOLD_TARGET_TYPES.has(targetType) ||
      subjectUserId === undefined ||
      !minimumNecessaryReason ||
      !metadata ||
      (!resourceKey && !targetRef && !subjectUserId)
    ) {
      return NextResponse.json({ error: "Preservation target data is invalid." }, { status: 400 });
    }

    const auditFailure = await auditOrFail(
      service,
      user.id,
      "preservation_target_add_attempt",
      "legal_preservation_hold",
      holdId,
      { target_type: targetType, request_id: requestId }
    );
    if (auditFailure) return auditFailure;

    const result = await service
      .from("legal_preservation_hold_targets")
      .insert({
        hold_id: holdId,
        resource_key: resourceKey,
        target_type: targetType,
        target_ref: targetRef,
        subject_user_id: subjectUserId,
        source_system: sourceSystem,
        minimum_necessary_reason: minimumNecessaryReason,
        metadata,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (result.error) {
      return NextResponse.json(
        { error: "Unable to add the preservation target." },
        { status: databaseStatus(result.error) }
      );
    }
    return NextResponse.json({ target: result.data }, { status: 201 });
  }

  if (["update_hold", "activate_hold", "release_hold", "expire_hold"].includes(operation)) {
    if (!hasCapability(authorization, "can_preserve")) return capabilityResponse("can_preserve");

    const holdId = cleanText(body.holdId, 80);
    if (!holdId || !UUID_PATTERN.test(holdId)) {
      return NextResponse.json({ error: "Valid holdId is required." }, { status: 400 });
    }
    const hold = await holdForRequest(service, requestId, holdId);
    if (!hold) return NextResponse.json({ error: "Preservation hold not found." }, { status: 404 });

    const patch: Record<string, unknown> = { updated_by: user.id };
    if (operation === "update_hold") {
      if (!["draft", "active"].includes(hold.status as string)) {
        return NextResponse.json({ error: "Released or expired holds cannot be edited." }, { status: 409 });
      }
      if (hasOwn(body, "legalBasisSummary")) {
        const value = requiredText(body.legalBasisSummary, 5, 12000);
        if (!value) return NextResponse.json({ error: "Invalid legal-basis summary." }, { status: 400 });
        patch.legal_basis_summary = value;
      }
      if (hasOwn(body, "scopeSummary")) {
        const value = requiredText(body.scopeSummary, 5, 20000);
        if (!value) return NextResponse.json({ error: "Invalid hold scope." }, { status: 400 });
        patch.scope_summary = value;
      }
      if (hasOwn(body, "expiresAt")) {
        const value = cleanTimestamp(body.expiresAt);
        if (value === undefined) return NextResponse.json({ error: "Invalid expiration time." }, { status: 400 });
        patch.expires_at = value;
        if (hold.status === "active") patch.extended_at = new Date().toISOString();
      }
      if (hasOwn(body, "nextReviewAt")) {
        const value = cleanTimestamp(body.nextReviewAt);
        if (value === undefined) return NextResponse.json({ error: "Invalid review time." }, { status: 400 });
        patch.next_review_at = value;
      }
      if (Object.keys(patch).length === 1) {
        return NextResponse.json({ error: "No supported hold fields were supplied." }, { status: 400 });
      }
    } else if (operation === "activate_hold") {
      if (hold.status !== "draft") {
        return NextResponse.json({ error: "Only a draft hold can be activated." }, { status: 409 });
      }
      const targetCount = await service
        .from("legal_preservation_hold_targets")
        .select("id", { count: "exact", head: true })
        .eq("hold_id", holdId);
      if (targetCount.error) {
        return NextResponse.json({ error: "Unable to verify hold targets." }, { status: 503 });
      }
      if (!targetCount.count) {
        return NextResponse.json(
          { error: "At least one preservation target is required before activation." },
          { status: 409 }
        );
      }
      const startsAt = cleanTimestamp(body.startsAt);
      if (startsAt === undefined) {
        return NextResponse.json({ error: "Invalid hold start time." }, { status: 400 });
      }
      patch.status = "active";
      patch.approved_by = user.id;
      patch.starts_at = startsAt ?? new Date().toISOString();
    } else if (operation === "release_hold") {
      if (hold.status !== "active") {
        return NextResponse.json({ error: "Only an active hold can be released." }, { status: 409 });
      }
      patch.status = "released";
      patch.released_at = new Date().toISOString();
    } else {
      if (hold.status !== "active") {
        return NextResponse.json({ error: "Only an active hold can be marked expired." }, { status: 409 });
      }
      if (!hold.expires_at || new Date(hold.expires_at as string).getTime() > Date.now()) {
        return NextResponse.json(
          { error: "An active hold cannot be marked expired before its recorded expiration time." },
          { status: 409 }
        );
      }
      patch.status = "expired";
    }

    const auditFailure = await auditOrFail(
      service,
      user.id,
      `preservation_hold_${operation}_attempt`,
      "legal_preservation_hold",
      holdId,
      { request_id: requestId }
    );
    if (auditFailure) return auditFailure;

    const result = await service
      .from("legal_preservation_holds")
      .update(patch)
      .eq("id", holdId)
      .eq("request_id", requestId)
      .select("*")
      .single();

    if (result.error) {
      return NextResponse.json(
        { error: "Unable to update the preservation hold." },
        { status: databaseStatus(result.error) }
      );
    }
    return NextResponse.json({ hold: result.data });
  }

  if (operation === "add_event") {
    if (!hasCapability(authorization, "can_intake")) return capabilityResponse("can_intake");

    const eventType = cleanText(body.eventType, 100) ?? "note";
    const action = requiredText(body.action, 2, 200);
    const purpose = cleanText(body.purpose, 4000);
    const details = safeObject(body.details ?? {});
    if (!MANUAL_EVENT_TYPES.has(eventType) || !action || !details) {
      return NextResponse.json({ error: "Handling event data is invalid." }, { status: 400 });
    }

    const auditFailure = await auditOrFail(
      service,
      user.id,
      "legal_request_event_add_attempt",
      "legal_request",
      requestId,
      { event_type: eventType, action }
    );
    if (auditFailure) return auditFailure;

    const result = await service
      .from("legal_request_events")
      .insert({
        request_id: requestId,
        event_type: eventType,
        action,
        purpose,
        details,
        actor_id: user.id,
      })
      .select("*")
      .single();

    if (result.error) {
      return NextResponse.json(
        { error: "Unable to record the handling event." },
        { status: databaseStatus(result.error) }
      );
    }
    return NextResponse.json({ event: result.data }, { status: 201 });
  }

  return NextResponse.json({ error: "Unsupported Legal Operations operation." }, { status: 400 });
}
