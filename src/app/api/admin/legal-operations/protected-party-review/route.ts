import { NextRequest, NextResponse } from "next/server";
import {
  recordLegalOperationsAudit,
  requireLegalOperationsAccess,
} from "@/lib/legal-operations/access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROTECTED_REVIEW_STATUSES = new Set([
  "unreviewed",
  "pending",
  "not_identified",
  "identified",
  "requires_counsel",
  "resolved",
]);

const MINIMIZATION_STATUSES = new Set([
  "unreviewed",
  "pending",
  "not_applicable",
  "required",
  "completed",
  "requires_counsel",
]);

const LIST_FIELDS = [
  "id",
  "request_number",
  "request_type",
  "status",
  "authority_review_status",
  "scope_review_status",
  "privilege_review_status",
  "reporter_protection_status",
  "victim_protection_status",
  "unrelated_member_minimization_status",
  "updated_at",
].join(",");

const DETAIL_FIELDS = [
  LIST_FIELDS,
  "jurisdiction",
  "narrowed_scope",
  "privilege_review_summary",
  "reporter_protection_summary",
  "victim_protection_summary",
  "unrelated_member_minimization_summary",
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
  targetId?: string | null,
  metadata?: Record<string, unknown>
) {
  const recorded = await recordLegalOperationsAudit(service, {
    actorId,
    action,
    targetType: "legal_request",
    targetId: targetId ?? null,
    metadata,
  });

  return recorded
    ? null
    : NextResponse.json(
        { error: "Protected-party review was blocked because audit recording failed." },
        { status: 503 }
      );
}

export async function GET(request: NextRequest) {
  const access = await requireLegalOperationsAccess(request, "can_review_requests");
  if (!access.user) return access.response;

  const { service, user, authorization } = access;
  const requestId = request.nextUrl.searchParams.get("requestId");

  if (!requestId) {
    const auditFailure = await auditOrFail(
      service,
      user.id,
      "legal_protected_party_workspace_view_attempt",
      null,
      { surface: "/admin/legal-operations/protected-party-review" }
    );
    if (auditFailure) return auditFailure;

    const result = await service
      .from("legal_requests")
      .select(LIST_FIELDS)
      .order("updated_at", { ascending: false })
      .limit(250);

    if (result.error) {
      return NextResponse.json(
        { error: "Unable to load protected-party review requests." },
        { status: 500 }
      );
    }

    return NextResponse.json({ authorization, requests: result.data ?? [] });
  }

  if (!UUID_PATTERN.test(requestId)) {
    return NextResponse.json({ error: "Invalid legal-request identifier." }, { status: 400 });
  }

  const auditFailure = await auditOrFail(
    service,
    user.id,
    "legal_protected_party_request_view_attempt",
    requestId,
    { surface: "/admin/legal-operations/protected-party-review" }
  );
  if (auditFailure) return auditFailure;

  const result = await service
    .from("legal_requests")
    .select(DETAIL_FIELDS)
    .eq("id", requestId)
    .maybeSingle();

  if (result.error) {
    return NextResponse.json(
      { error: "Unable to load protected-party review metadata." },
      { status: 500 }
    );
  }
  if (!result.data) {
    return NextResponse.json({ error: "Legal request not found." }, { status: 404 });
  }

  const accessEvent = await service.from("legal_request_events").insert({
    request_id: requestId,
    event_type: "access",
    action: "legal_protected_party_review_viewed",
    purpose: "Authorized protected-party and unrelated-member minimization review.",
    details: { surface: "/admin/legal-operations/protected-party-review" },
    actor_id: user.id,
  });

  if (accessEvent.error) {
    return NextResponse.json(
      { error: "Protected-party metadata could not be opened because access auditing failed." },
      { status: 503 }
    );
  }

  return NextResponse.json({ authorization, request: result.data });
}

export async function POST(request: NextRequest) {
  const access = await requireLegalOperationsAccess(request, "can_review_requests");
  if (!access.user) return access.response;

  const { service, user } = access;
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (cleanText(body.operation, 80) !== "update_protected_party_review") {
    return NextResponse.json(
      { error: "Only protected-party review metadata updates are enabled on this route." },
      { status: 409 }
    );
  }

  const requestId = cleanText(body.requestId, 80);
  if (!requestId || !UUID_PATTERN.test(requestId)) {
    return NextResponse.json({ error: "Valid requestId is required." }, { status: 400 });
  }

  const privilegeReviewStatus = cleanText(body.privilegeReviewStatus, 100);
  const reporterProtectionStatus = cleanText(body.reporterProtectionStatus, 100);
  const victimProtectionStatus = cleanText(body.victimProtectionStatus, 100);
  const unrelatedMemberMinimizationStatus = cleanText(
    body.unrelatedMemberMinimizationStatus,
    100
  );

  if (
    !privilegeReviewStatus ||
    !PROTECTED_REVIEW_STATUSES.has(privilegeReviewStatus) ||
    !reporterProtectionStatus ||
    !PROTECTED_REVIEW_STATUSES.has(reporterProtectionStatus) ||
    !victimProtectionStatus ||
    !PROTECTED_REVIEW_STATUSES.has(victimProtectionStatus) ||
    !unrelatedMemberMinimizationStatus ||
    !MINIMIZATION_STATUSES.has(unrelatedMemberMinimizationStatus)
  ) {
    return NextResponse.json({ error: "Protected-party review status is invalid." }, { status: 400 });
  }

  const patch = {
    privilege_review_status: privilegeReviewStatus,
    privilege_review_summary: cleanText(body.privilegeReviewSummary, 4000),
    reporter_protection_status: reporterProtectionStatus,
    reporter_protection_summary: cleanText(body.reporterProtectionSummary, 4000),
    victim_protection_status: victimProtectionStatus,
    victim_protection_summary: cleanText(body.victimProtectionSummary, 4000),
    unrelated_member_minimization_status: unrelatedMemberMinimizationStatus,
    unrelated_member_minimization_summary: cleanText(
      body.unrelatedMemberMinimizationSummary,
      4000
    ),
    updated_by: user.id,
  };

  const auditFailure = await auditOrFail(
    service,
    user.id,
    "legal_protected_party_review_update_attempt",
    requestId,
    {
      fields: [
        "privilege_review_status",
        "privilege_review_summary",
        "reporter_protection_status",
        "reporter_protection_summary",
        "victim_protection_status",
        "victim_protection_summary",
        "unrelated_member_minimization_status",
        "unrelated_member_minimization_summary",
      ],
    }
  );
  if (auditFailure) return auditFailure;

  const result = await service
    .from("legal_requests")
    .update(patch)
    .eq("id", requestId)
    .select(DETAIL_FIELDS)
    .single();

  if (result.error) {
    return NextResponse.json(
      { error: "Unable to update protected-party review metadata." },
      { status: databaseStatus(result.error) }
    );
  }

  return NextResponse.json({ request: result.data });
}
