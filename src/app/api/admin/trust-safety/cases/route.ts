import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SEVERITIES = new Set(["S1", "S2", "S3", "S4"]);
const STATUSES = new Set([
  "new",
  "triage",
  "contained",
  "reviewing",
  "awaiting_specialist",
  "awaiting_legal",
  "monitoring",
  "closed",
]);
const SOURCE_TYPES = new Set([
  "report",
  "room_moderation",
  "security_email",
  "privacy_email",
  "legal_email",
  "support_email",
  "system",
  "manual",
  "other",
]);
const CATEGORIES = new Set([
  "credible_threat",
  "child_safety",
  "sexual_exploitation",
  "intimate_image_abuse",
  "sextortion",
  "stalking",
  "doxxing",
  "trafficking",
  "dangerous_organization",
  "self_harm",
  "fraud",
  "account_security",
  "harassment",
  "impersonation",
  "privacy",
  "room_safety",
  "other",
]);
const MANUAL_EVENT_TYPES = new Set(["handling", "note", "specialist_routing"]);

type JsonObject = Record<string, unknown>;

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
  if (value === null || value === "") return null;
  if (typeof value === "string" && UUID_PATTERN.test(value)) return value;
  return undefined;
}

function safeObject(value: unknown, maxBytes = 20000): JsonObject | null {
  if (!isRecord(value)) return null;
  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).length > maxBytes) return null;
  return value;
}

function cleanCategories(value: unknown) {
  if (!Array.isArray(value)) return null;
  const normalized = [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => CATEGORIES.has(item))
    ),
  ];
  return normalized.length <= 10 ? normalized : null;
}

function getAuthClient(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: authorization ? { Authorization: authorization } : {} },
    }
  );
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service configuration.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin(request: NextRequest) {
  const auth = getAuthClient(request);
  const {
    data: { user },
    error,
  } = await auth.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const { data: profile } = await auth
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}

function databaseStatus(error: { code?: string } | null) {
  if (!error) return 500;
  if (["22023", "23502", "23503", "23505", "23514"].includes(error.code ?? "")) {
    return 400;
  }
  if (error.code === "42501") return 403;
  return 500;
}

async function caseExists(
  service: ReturnType<typeof getServiceClient>,
  caseId: string
) {
  const result = await service
    .from("trust_safety_cases")
    .select("id")
    .eq("id", caseId)
    .maybeSingle();
  return !result.error && Boolean(result.data);
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.user) return admin.response!;

  let service: ReturnType<typeof getServiceClient>;
  try {
    service = getServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Trust and Safety case storage is not configured." },
      { status: 503 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const caseId = searchParams.get("caseId");

  if (caseId) {
    if (!UUID_PATTERN.test(caseId)) {
      return NextResponse.json({ error: "Invalid case identifier." }, { status: 400 });
    }

    const caseResult = await service
      .from("trust_safety_cases")
      .select("*")
      .eq("id", caseId)
      .maybeSingle();

    if (caseResult.error) {
      return NextResponse.json(
        { error: "Unable to load the Trust and Safety case." },
        { status: 500 }
      );
    }
    if (!caseResult.data) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    const accessEvent = await service.from("trust_safety_case_events").insert({
      case_id: caseId,
      event_type: "access",
      action: "case_viewed",
      purpose: "Authorized administrator case review.",
      details: { surface: "/admin/reports/trust-safety" },
      actor_id: admin.user.id,
    });

    if (accessEvent.error) {
      return NextResponse.json(
        { error: "The case could not be opened because access auditing failed." },
        { status: 503 }
      );
    }

    const [evidenceResult, eventsResult] = await Promise.all([
      service
        .from("trust_safety_case_evidence_refs")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true }),
      service
        .from("trust_safety_case_events")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    if (evidenceResult.error || eventsResult.error) {
      return NextResponse.json(
        { error: "Unable to load the case evidence references or event history." },
        { status: 500 }
      );
    }

    await logAuditEvent({
      actor_id: admin.user.id,
      action: "trust_safety_case_viewed",
      target_type: "trust_safety_case",
      target_id: caseId,
      metadata: { case_number: caseResult.data.case_number },
    });

    return NextResponse.json({
      case: caseResult.data,
      evidence: evidenceResult.data ?? [],
      events: eventsResult.data ?? [],
    });
  }

  const status = searchParams.get("status");
  const severity = searchParams.get("severity");

  let query = service
    .from("trust_safety_cases")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(250);

  if (status && STATUSES.has(status)) query = query.eq("status", status);
  if (severity && SEVERITIES.has(severity)) query = query.eq("severity", severity);

  const result = await query;
  if (result.error) {
    return NextResponse.json(
      { error: "Unable to load Trust and Safety cases." },
      { status: 500 }
    );
  }

  await logAuditEvent({
    actor_id: admin.user.id,
    action: "trust_safety_case_list_viewed",
    target_type: "trust_safety_case_workspace",
    metadata: {
      status_filter: status && STATUSES.has(status) ? status : null,
      severity_filter: severity && SEVERITIES.has(severity) ? severity : null,
      returned_count: result.data?.length ?? 0,
    },
  });

  return NextResponse.json({ cases: result.data ?? [] });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.user) return admin.response!;

  let service: ReturnType<typeof getServiceClient>;
  try {
    service = getServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Trust and Safety case storage is not configured." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const operation = cleanText(body.operation, 80) ?? "create_case";

  if (operation === "create_case") {
    const summary = requiredText(body.summary, 10, 4000);
    const severity = cleanText(body.severity, 2) ?? "S4";
    const primaryCategory = cleanText(body.primaryCategory, 100) ?? "other";
    const sourceType = cleanText(body.sourceType, 100) ?? "manual";
    const sourceId = cleanText(body.sourceId, 500);
    const secondaryCategories = cleanCategories(body.secondaryCategories ?? []);
    const targetRefs = safeObject(body.targetRefs ?? {});
    const assignedTo = hasOwn(body, "assignedTo")
      ? nullableUuid(body.assignedTo)
      : admin.user.id;

    if (!summary) {
      return NextResponse.json(
        { error: "Case summary must contain at least 10 characters." },
        { status: 400 }
      );
    }
    if (!SEVERITIES.has(severity) || !CATEGORIES.has(primaryCategory)) {
      return NextResponse.json(
        { error: "Choose a valid severity and case category." },
        { status: 400 }
      );
    }
    if (!SOURCE_TYPES.has(sourceType) || secondaryCategories === null || !targetRefs) {
      return NextResponse.json(
        { error: "The case source or reference data is invalid." },
        { status: 400 }
      );
    }
    if (assignedTo === undefined) {
      return NextResponse.json({ error: "Invalid assignee." }, { status: 400 });
    }

    const result = await service
      .from("trust_safety_cases")
      .insert({
        source_type: sourceType,
        source_id: sourceId,
        severity,
        primary_category: primaryCategory,
        secondary_categories: secondaryCategories,
        status: "new",
        summary,
        target_refs: targetRefs,
        assigned_to: assignedTo,
        created_by: admin.user.id,
        updated_by: admin.user.id,
      })
      .select("*")
      .single();

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: "Unable to create the Trust and Safety case." },
        { status: databaseStatus(result.error) }
      );
    }

    await logAuditEvent({
      actor_id: admin.user.id,
      action: "trust_safety_case_created",
      target_type: "trust_safety_case",
      target_id: result.data.id,
      metadata: {
        case_number: result.data.case_number,
        severity,
        primary_category: primaryCategory,
        source_type: sourceType,
      },
    });

    return NextResponse.json({ case: result.data }, { status: 201 });
  }

  const caseId = cleanText(body.caseId, 80);
  if (!caseId || !UUID_PATTERN.test(caseId)) {
    return NextResponse.json({ error: "Invalid case identifier." }, { status: 400 });
  }
  if (!(await caseExists(service, caseId))) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  if (operation === "add_evidence") {
    const evidenceType = requiredText(body.evidenceType, 2, 100);
    const sourceSystem = requiredText(body.sourceSystem, 2, 100);
    const collectionPurpose = requiredText(body.collectionPurpose, 5, 2000);
    const minimumNecessary = requiredText(
      body.minimumNecessaryJustification,
      5,
      2000
    );
    const metadata = safeObject(body.metadata ?? {});

    if (!evidenceType || !sourceSystem || !collectionPurpose || !minimumNecessary || !metadata) {
      return NextResponse.json(
        { error: "Complete the required evidence-reference fields." },
        { status: 400 }
      );
    }

    const result = await service
      .from("trust_safety_case_evidence_refs")
      .insert({
        case_id: caseId,
        evidence_type: evidenceType,
        source_system: sourceSystem,
        source_table: cleanText(body.sourceTable, 160),
        source_record_id: cleanText(body.sourceRecordId, 500),
        storage_reference: cleanText(body.storageReference, 2000),
        existing_hash: cleanText(body.existingHash, 512),
        original_timestamp: cleanText(body.originalTimestamp, 100),
        collection_purpose: collectionPurpose,
        minimum_necessary_justification: minimumNecessary,
        preservation_status: cleanText(body.preservationStatus, 500) ?? "referenced",
        metadata,
        created_by: admin.user.id,
      })
      .select("*")
      .single();

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: "Unable to add the evidence reference." },
        { status: databaseStatus(result.error) }
      );
    }

    await logAuditEvent({
      actor_id: admin.user.id,
      action: "trust_safety_evidence_reference_added",
      target_type: "trust_safety_case",
      target_id: caseId,
      metadata: {
        evidence_ref_id: result.data.id,
        evidence_type: evidenceType,
        source_system: sourceSystem,
      },
    });

    return NextResponse.json({ evidence: result.data }, { status: 201 });
  }

  if (operation === "add_event") {
    const eventType = cleanText(body.eventType, 100) ?? "handling";
    const action = requiredText(body.action, 2, 160);
    const details = safeObject(body.details ?? {});
    const evidenceRefId = nullableUuid(body.evidenceRefId);

    if (!MANUAL_EVENT_TYPES.has(eventType) || !action || !details) {
      return NextResponse.json(
        { error: "The handling-log event is invalid." },
        { status: 400 }
      );
    }
    if (evidenceRefId === undefined) {
      return NextResponse.json(
        { error: "Invalid evidence-reference identifier." },
        { status: 400 }
      );
    }

    const result = await service
      .from("trust_safety_case_events")
      .insert({
        case_id: caseId,
        evidence_ref_id: evidenceRefId,
        event_type: eventType,
        action,
        purpose: cleanText(body.purpose, 2000),
        previous_location: cleanText(body.previousLocation, 2000),
        new_location: cleanText(body.newLocation, 2000),
        details,
        actor_id: admin.user.id,
      })
      .select("*")
      .single();

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: "Unable to append the handling-log event." },
        { status: databaseStatus(result.error) }
      );
    }

    await logAuditEvent({
      actor_id: admin.user.id,
      action: "trust_safety_case_event_added",
      target_type: "trust_safety_case",
      target_id: caseId,
      metadata: { event_id: result.data.id, event_type: eventType, action },
    });

    return NextResponse.json({ event: result.data }, { status: 201 });
  }

  return NextResponse.json({ error: "Unsupported operation." }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.user) return admin.response!;

  let service: ReturnType<typeof getServiceClient>;
  try {
    service = getServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Trust and Safety case storage is not configured." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const caseId = cleanText(body.caseId, 80);
  if (!caseId || !UUID_PATTERN.test(caseId)) {
    return NextResponse.json({ error: "Invalid case identifier." }, { status: 400 });
  }

  const existing = await service
    .from("trust_safety_cases")
    .select("id, status")
    .eq("id", caseId)
    .maybeSingle();

  if (existing.error) {
    return NextResponse.json(
      { error: "Unable to load the case for update." },
      { status: 500 }
    );
  }
  if (!existing.data) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  const update: JsonObject = { updated_by: admin.user.id };
  const changedFields: string[] = [];

  if (hasOwn(body, "severity")) {
    const value = cleanText(body.severity, 2);
    if (!value || !SEVERITIES.has(value)) {
      return NextResponse.json({ error: "Invalid severity." }, { status: 400 });
    }
    update.severity = value;
    changedFields.push("severity");
  }

  if (hasOwn(body, "primaryCategory")) {
    const value = cleanText(body.primaryCategory, 100);
    if (!value || !CATEGORIES.has(value)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    update.primary_category = value;
    changedFields.push("primary_category");
  }

  if (hasOwn(body, "secondaryCategories")) {
    const value = cleanCategories(body.secondaryCategories);
    if (value === null) {
      return NextResponse.json(
        { error: "Invalid secondary categories." },
        { status: 400 }
      );
    }
    update.secondary_categories = value;
    changedFields.push("secondary_categories");
  }

  if (hasOwn(body, "status")) {
    const value = cleanText(body.status, 100);
    if (!value || !STATUSES.has(value)) {
      return NextResponse.json({ error: "Invalid case status." }, { status: 400 });
    }
    update.status = value;
    if (value === "closed") {
      update.closed_at = new Date().toISOString();
      update.closed_by = admin.user.id;
    } else {
      update.closed_at = null;
      update.closed_by = null;
    }
    changedFields.push("status");
  }

  if (hasOwn(body, "assignedTo")) {
    const value = nullableUuid(body.assignedTo);
    if (value === undefined) {
      return NextResponse.json({ error: "Invalid assignee." }, { status: 400 });
    }
    update.assigned_to = value;
    changedFields.push("assigned_to");
  }

  const textFields: Array<[string, string, number, number]> = [
    ["summary", "summary", 4000, 10],
    ["reportedRisk", "reported_risk", 10000, 0],
    ["observedFacts", "observed_facts", 12000, 0],
    ["unresolvedFacts", "unresolved_facts", 12000, 0],
    ["reviewerInference", "reviewer_inference", 10000, 0],
    ["containmentSummary", "containment_summary", 10000, 0],
    ["decision", "decision", 12000, 0],
    ["decisionRationale", "decision_rationale", 12000, 0],
    ["externalEscalationStatus", "external_escalation_status", 4000, 0],
    ["memberNoticeDecision", "member_notice_decision", 4000, 0],
    ["preservationStatus", "preservation_status", 4000, 0],
  ];

  for (const [inputKey, databaseKey, maxLength, minimumLength] of textFields) {
    if (!hasOwn(body, inputKey)) continue;
    const value = cleanText(body[inputKey], maxLength);
    if (minimumLength > 0 && (!value || value.length < minimumLength)) {
      return NextResponse.json(
        { error: "Case summary must contain at least 10 characters." },
        { status: 400 }
      );
    }
    update[databaseKey] = value;
    changedFields.push(databaseKey);
  }

  if (hasOwn(body, "targetRefs")) {
    const value = safeObject(body.targetRefs);
    if (!value) {
      return NextResponse.json({ error: "Invalid target references." }, { status: 400 });
    }
    update.target_refs = value;
    changedFields.push("target_refs");
  }

  if (changedFields.length === 0) {
    return NextResponse.json({ error: "No case changes were provided." }, { status: 400 });
  }

  const result = await service
    .from("trust_safety_cases")
    .update(update)
    .eq("id", caseId)
    .select("*")
    .single();

  if (result.error || !result.data) {
    return NextResponse.json(
      { error: "Unable to update the Trust and Safety case." },
      { status: databaseStatus(result.error) }
    );
  }

  await logAuditEvent({
    actor_id: admin.user.id,
    action: "trust_safety_case_updated",
    target_type: "trust_safety_case",
    target_id: caseId,
    metadata: {
      case_number: result.data.case_number,
      changed_fields: changedFields,
      previous_status: existing.data.status,
      status: result.data.status,
    },
  });

  return NextResponse.json({ case: result.data });
}
