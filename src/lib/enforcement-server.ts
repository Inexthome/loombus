import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  APPEAL_OPEN_STATES,
  PUBLIC_REASON_LABELS,
  TARGET_INTEGRATION_STATUS,
  getActionLabel,
  type AppealOutcome,
  type EnforcementConfidence,
  type EnforcementSeverity,
  type EnforcementTargetType,
  type MemberEnforcementAppeal,
  type MemberEnforcementDecision,
  type MemberEnforcementEvent,
  type PublicReasonCode,
} from "@/lib/enforcement-contract";

export type EnforcementDecisionRow = {
  id: string;
  subject_user_id: string | null;
  target_type: EnforcementTargetType;
  target_id: string | null;
  target_label: string | null;
  source_report_id: string | null;
  source_kind: string;
  source_key: string | null;
  policy_document_id: string;
  policy_version: string;
  public_reason_code: PublicReasonCode;
  primary_reason_code: string;
  secondary_reason_codes: string[] | null;
  context_modifiers: string[] | null;
  severity: EnforcementSeverity;
  confidence: EnforcementConfidence;
  action_code: string;
  action_scope: string;
  action_parameters: Record<string, unknown> | null;
  member_explanation: string;
  internal_note: string | null;
  status: string;
  effective_at: string;
  expires_at: string | null;
  resolved_at: string | null;
  actor_user_id: string | null;
  reviewer_user_id: string | null;
  appeal_eligibility: string;
  appeal_deadline: string | null;
  notice_status: string;
  notice_sent_at: string | null;
  restoration_status: string;
  restoration_note: string | null;
  confidentiality: string;
  legal_hold: boolean;
  created_at: string;
  updated_at: string;
};

export type EnforcementAppealRow = {
  id: string;
  decision_id: string;
  appellant_user_id: string;
  statement: string;
  additional_context: string | null;
  has_new_information: boolean;
  status: string;
  outcome: AppealOutcome | null;
  assigned_reviewer_id: string | null;
  conflict_status: string;
  conflict_override_reason: string | null;
  member_outcome_message: string | null;
  internal_review_note: string | null;
  submitted_at: string;
  review_started_at: string | null;
  decided_at: string | null;
  closed_at: string | null;
  updated_at: string;
};

export type EnforcementEventRow = {
  id: number;
  decision_id: string;
  appeal_id: string | null;
  event_type: string;
  actor_user_id: string | null;
  member_visible: boolean;
  member_message: string | null;
  internal_note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type CreateDecisionInput = {
  subjectUserId?: string | null;
  targetType: EnforcementTargetType;
  targetId?: string | null;
  targetLabel?: string | null;
  sourceReportId?: string | null;
  sourceKind?: string;
  sourceKey?: string | null;
  policyDocumentId?: string;
  policyVersion?: string;
  publicReasonCode: PublicReasonCode;
  primaryReasonCode: string;
  secondaryReasonCodes?: string[];
  contextModifiers?: string[];
  severity: EnforcementSeverity;
  confidence: EnforcementConfidence;
  actionCode: string;
  actionScope?: string;
  actionParameters?: Record<string, unknown>;
  memberExplanation: string;
  internalNote?: string | null;
  status?: string;
  effectiveAt?: string;
  expiresAt?: string | null;
  actorUserId: string;
  appealEligibility?: string;
  appealDeadline?: string | null;
  confidentiality?: "standard" | "restricted" | "highly_restricted";
  restorationStatus?: string;
};

let serviceClient: SupabaseClient | null = null;

export function getEnforcementServiceClient() {
  if (serviceClient) return serviceClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing enforcement service configuration.");
  }

  serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

export function getDefaultAppealDeadline(now = new Date()) {
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

export async function createEnforcementDecision(
  input: CreateDecisionInput,
  client = getEnforcementServiceClient()
) {
  if (input.sourceKey) {
    const existing = await client
      .from("enforcement_decisions")
      .select("*")
      .eq("source_key", input.sourceKey)
      .maybeSingle<EnforcementDecisionRow>();
    if (existing.error) throw existing.error;
    if (existing.data) return existing.data;
  }

  const now = input.effectiveAt ?? new Date().toISOString();
  const appealEligibility = input.appealEligibility ?? "APL.ELIGIBLE";
  const appealDeadline =
    input.appealDeadline === undefined && appealEligibility === "APL.ELIGIBLE"
      ? getDefaultAppealDeadline(new Date(now))
      : input.appealDeadline ?? null;

  const inserted = await client
    .from("enforcement_decisions")
    .insert({
      subject_user_id: input.subjectUserId ?? null,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      target_label: input.targetLabel ?? null,
      source_report_id: input.sourceReportId ?? null,
      source_kind: input.sourceKind ?? "admin_action",
      source_key: input.sourceKey ?? null,
      policy_document_id: input.policyDocumentId ?? "EA-001",
      policy_version: input.policyVersion ?? "implementation-v1",
      public_reason_code: input.publicReasonCode,
      primary_reason_code: input.primaryReasonCode,
      secondary_reason_codes: input.secondaryReasonCodes ?? [],
      context_modifiers: input.contextModifiers ?? [],
      severity: input.severity,
      confidence: input.confidence,
      action_code: input.actionCode,
      action_scope: input.actionScope ?? "target",
      action_parameters: input.actionParameters ?? {},
      member_explanation: input.memberExplanation,
      internal_note: input.internalNote ?? null,
      status: input.status ?? "active",
      effective_at: now,
      expires_at: input.expiresAt ?? null,
      actor_user_id: input.actorUserId,
      appeal_eligibility: appealEligibility,
      appeal_deadline: appealDeadline,
      notice_status: input.subjectUserId ? "pending" : "not_required",
      restoration_status: input.restorationStatus ?? "RST.NOT_APPLICABLE",
      confidentiality: input.confidentiality ?? "standard",
    })
    .select("*")
    .single<EnforcementDecisionRow>();
  if (inserted.error) throw inserted.error;

  const event = await client.from("enforcement_events").insert({
    decision_id: inserted.data.id,
    event_type: "decision_created",
    actor_user_id: input.actorUserId,
    member_visible: true,
    member_message: input.memberExplanation,
    metadata: {
      action_code: input.actionCode,
      public_reason_code: input.publicReasonCode,
      severity: input.severity,
    },
  });
  if (event.error) throw event.error;

  return inserted.data;
}

export async function markDecisionNoticeSent(
  decisionId: string,
  sent: boolean,
  client = getEnforcementServiceClient()
) {
  const now = new Date().toISOString();
  const result = await client
    .from("enforcement_decisions")
    .update({
      notice_status: sent ? "sent" : "failed",
      notice_sent_at: sent ? now : null,
    })
    .eq("id", decisionId);
  if (result.error) throw result.error;
}

export async function getMemberEnforcementHistory(userId: string) {
  const client = getEnforcementServiceClient();
  const decisionsResult = await client
    .from("enforcement_decisions")
    .select("*")
    .eq("subject_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (decisionsResult.error) throw decisionsResult.error;

  const decisions = (decisionsResult.data ?? []) as EnforcementDecisionRow[];
  if (decisions.length === 0) return [] as MemberEnforcementDecision[];
  const ids = decisions.map((decision) => decision.id);

  const [appealsResult, eventsResult] = await Promise.all([
    client
      .from("enforcement_appeals")
      .select("*")
      .in("decision_id", ids)
      .eq("appellant_user_id", userId)
      .order("submitted_at", { ascending: false }),
    client
      .from("enforcement_events")
      .select("id, decision_id, event_type, member_message, created_at")
      .in("decision_id", ids)
      .eq("member_visible", true)
      .order("created_at", { ascending: true }),
  ]);
  if (appealsResult.error) throw appealsResult.error;
  if (eventsResult.error) throw eventsResult.error;

  const appealsByDecision = new Map<string, EnforcementAppealRow>();
  for (const appeal of (appealsResult.data ?? []) as EnforcementAppealRow[]) {
    if (!appealsByDecision.has(appeal.decision_id)) {
      appealsByDecision.set(appeal.decision_id, appeal);
    }
  }

  const eventsByDecision = new Map<string, MemberEnforcementEvent[]>();
  for (const event of (eventsResult.data ?? []) as Array<{
    id: number;
    decision_id: string;
    event_type: string;
    member_message: string | null;
    created_at: string;
  }>) {
    const list = eventsByDecision.get(event.decision_id) ?? [];
    list.push({
      id: event.id,
      eventType: event.event_type,
      message: event.member_message,
      createdAt: event.created_at,
    });
    eventsByDecision.set(event.decision_id, list);
  }

  return decisions.map((decision) => {
    const appeal = appealsByDecision.get(decision.id) ?? null;
    return {
      id: decision.id,
      targetType: decision.target_type,
      targetId: decision.target_id,
      targetLabel: decision.target_label || decision.target_type,
      policyDocumentId: decision.policy_document_id,
      policyVersion: decision.policy_version,
      publicReasonCode: decision.public_reason_code,
      publicReasonLabel:
        PUBLIC_REASON_LABELS[decision.public_reason_code] ?? "Other policy concern",
      primaryReasonCode: decision.primary_reason_code,
      severity: decision.severity,
      actionCode: decision.action_code,
      actionLabel: getActionLabel(decision.action_code),
      actionScope: decision.action_scope,
      memberExplanation: decision.member_explanation,
      status: decision.status,
      effectiveAt: decision.effective_at,
      expiresAt: decision.expires_at,
      resolvedAt: decision.resolved_at,
      appealEligibility: decision.appeal_eligibility,
      appealDeadline: decision.appeal_deadline,
      restorationStatus: decision.restoration_status,
      restorationNote: decision.restoration_note,
      createdAt: decision.created_at,
      events: eventsByDecision.get(decision.id) ?? [],
      appeal: appeal
        ? {
            id: appeal.id,
            status: appeal.status,
            outcome: appeal.outcome,
            statement: appeal.statement,
            additionalContext: appeal.additional_context,
            hasNewInformation: appeal.has_new_information,
            memberOutcomeMessage: appeal.member_outcome_message,
            submittedAt: appeal.submitted_at,
            reviewStartedAt: appeal.review_started_at,
            decidedAt: appeal.decided_at,
            closedAt: appeal.closed_at,
          }
        : null,
    } satisfies MemberEnforcementDecision;
  });
}

export async function createMemberAppeal({
  decisionId,
  userId,
  statement,
  additionalContext,
  hasNewInformation,
}: {
  decisionId: string;
  userId: string;
  statement: string;
  additionalContext?: string | null;
  hasNewInformation: boolean;
}) {
  const client = getEnforcementServiceClient();
  const decision = await client
    .from("enforcement_decisions")
    .select("*")
    .eq("id", decisionId)
    .eq("subject_user_id", userId)
    .maybeSingle<EnforcementDecisionRow>();
  if (decision.error) throw decision.error;
  if (!decision.data) throw new Error("Enforcement decision not found.");

  if (
    !new Set(["APL.ELIGIBLE", "APL.ELIGIBLE_AFTER_ACTION"]).has(
      decision.data.appeal_eligibility
    )
  ) {
    throw new Error("This decision is not eligible for appeal.");
  }

  if (
    decision.data.appeal_deadline &&
    new Date(decision.data.appeal_deadline).getTime() < Date.now()
  ) {
    const expired = await client
      .from("enforcement_decisions")
      .update({ appeal_eligibility: "APL.DEADLINE_PASSED" })
      .eq("id", decisionId);
    if (expired.error) throw expired.error;
    throw new Error("The appeal deadline has passed.");
  }

  const existing = await client
    .from("enforcement_appeals")
    .select("id, status")
    .eq("decision_id", decisionId)
    .eq("appellant_user_id", userId)
    .order("submitted_at", { ascending: false });
  if (existing.error) throw existing.error;
  const open = (existing.data ?? []).find((row) =>
    APPEAL_OPEN_STATES.has(String(row.status))
  );
  if (open) throw new Error("An appeal for this decision is already open.");

  const inserted = await client
    .from("enforcement_appeals")
    .insert({
      decision_id: decisionId,
      appellant_user_id: userId,
      statement,
      additional_context: additionalContext || null,
      has_new_information: hasNewInformation,
      status: "APL.SUBMITTED",
    })
    .select("*")
    .single<EnforcementAppealRow>();
  if (inserted.error) throw inserted.error;

  const event = await client.from("enforcement_events").insert({
    decision_id: decisionId,
    appeal_id: inserted.data.id,
    event_type: "appeal_submitted",
    actor_user_id: userId,
    member_visible: true,
    member_message: "Your appeal was submitted and is waiting for review.",
  });
  if (event.error) throw event.error;
  return inserted.data;
}

export async function listAdminEnforcementQueue() {
  const client = getEnforcementServiceClient();
  const [decisions, appeals, profiles, restorationAttempts] = await Promise.all([
    client
      .from("enforcement_decisions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    client
      .from("enforcement_appeals")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(500),
    client
      .from("profiles")
      .select("id, username, full_name, avatar_url, is_admin, account_status"),
    client
      .from("enforcement_restoration_attempts")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(500),
  ]);
  if (decisions.error) throw decisions.error;
  if (appeals.error) throw appeals.error;
  if (profiles.error) throw profiles.error;
  if (restorationAttempts.error) throw restorationAttempts.error;
  return {
    decisions: (decisions.data ?? []) as EnforcementDecisionRow[],
    appeals: (appeals.data ?? []) as EnforcementAppealRow[],
    profiles: profiles.data ?? [],
    restorationAttempts: restorationAttempts.data ?? [],
  };
}

async function recordRestorationAttempt({
  decision,
  appealId,
  actorUserId,
  status,
  resultMessage,
  exceptionCode,
  memberVisible,
  internalNote,
}: {
  decision: EnforcementDecisionRow;
  appealId: string | null;
  actorUserId: string;
  status: string;
  resultMessage: string;
  exceptionCode?: string | null;
  memberVisible: boolean;
  internalNote?: string | null;
}) {
  const client = getEnforcementServiceClient();
  const now = new Date().toISOString();
  const attempt = await client.from("enforcement_restoration_attempts").insert({
    decision_id: decision.id,
    appeal_id: appealId,
    attempted_by: actorUserId,
    adapter: decision.target_type,
    status,
    result_message: resultMessage,
    exception_code: exceptionCode ?? null,
    completed_at: now,
  });
  if (attempt.error) throw attempt.error;

  const update = await client
    .from("enforcement_decisions")
    .update({ restoration_status: status, restoration_note: resultMessage })
    .eq("id", decision.id);
  if (update.error) throw update.error;

  const event = await client.from("enforcement_events").insert({
    decision_id: decision.id,
    appeal_id: appealId,
    event_type:
      status === "RST.COMPLETED" ? "appeal_restoration_completed" : "restoration_exception",
    actor_user_id: actorUserId,
    member_visible: memberVisible,
    member_message: memberVisible ? resultMessage : null,
    internal_note: internalNote ?? null,
    metadata: { exception_code: exceptionCode ?? null, restoration_status: status },
  });
  if (event.error) throw event.error;
}

export async function restoreDecisionTarget({
  decision,
  appealId,
  actorUserId,
  memberMessage,
  internalNote,
}: {
  decision: EnforcementDecisionRow;
  appealId?: string | null;
  actorUserId: string;
  memberMessage: string;
  internalNote?: string | null;
}) {
  const client = getEnforcementServiceClient();
  const now = new Date().toISOString();

  if (decision.legal_hold) {
    await recordRestorationAttempt({
      decision,
      appealId: appealId ?? null,
      actorUserId,
      status: "RST.BLOCKED_LEGAL",
      resultMessage: "Restoration is blocked by an active legal hold.",
      exceptionCode: "LEGAL_HOLD",
      memberVisible: true,
      internalNote,
    });
    return { status: "RST.BLOCKED_LEGAL", restored: false } as const;
  }

  const integration = TARGET_INTEGRATION_STATUS[decision.target_type];
  if (integration.restoration === "manual") {
    const message =
      "The decision was reversed, but this product area requires manual restoration.";
    const decisionUpdate = await client
      .from("enforcement_decisions")
      .update({
        status: "reversed",
        resolved_at: now,
        reviewer_user_id: actorUserId,
        restoration_status: "RST.PARTIAL",
        restoration_note: message,
      })
      .eq("id", decision.id);
    if (decisionUpdate.error) throw decisionUpdate.error;

    await recordRestorationAttempt({
      decision,
      appealId: appealId ?? null,
      actorUserId,
      status: "RST.PARTIAL",
      resultMessage: message,
      exceptionCode: "MANUAL_ADAPTER_REQUIRED",
      memberVisible: true,
      internalNote,
    });
    return { status: "RST.PARTIAL", restored: false } as const;
  }

  if (!decision.target_id) {
    await recordRestorationAttempt({
      decision,
      appealId: appealId ?? null,
      actorUserId,
      status: "RST.SOURCE_NO_LONGER_EXISTS",
      resultMessage: "The original target identifier is unavailable.",
      exceptionCode: "TARGET_ID_MISSING",
      memberVisible: true,
      internalNote,
    });
    return { status: "RST.SOURCE_NO_LONGER_EXISTS", restored: false } as const;
  }

  let sourceError: string | null = null;
  let sourceExists = false;

  if (decision.target_type === "account" && decision.subject_user_id) {
    const result = await client
      .from("profiles")
      .update({
        account_status: "active",
        enforcement_reason: null,
        enforcement_note: null,
        enforced_by: actorUserId,
        enforced_at: now,
        suspended_until: null,
      })
      .eq("id", decision.subject_user_id)
      .select("id")
      .maybeSingle();
    sourceError = result.error?.message ?? null;
    sourceExists = Boolean(result.data);
  } else if (decision.target_type === "discussion") {
    const result = await client
      .from("discussions")
      .update({ deleted_at: null, deleted_by: null, deletion_reason: null })
      .eq("id", decision.target_id)
      .select("id")
      .maybeSingle();
    sourceError = result.error?.message ?? null;
    sourceExists = Boolean(result.data);
  } else if (decision.target_type === "reply") {
    const result = await client
      .from("replies")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", decision.target_id)
      .select("id")
      .maybeSingle();
    sourceError = result.error?.message ?? null;
    sourceExists = Boolean(result.data);
  }

  if (sourceError) {
    await recordRestorationAttempt({
      decision,
      appealId: appealId ?? null,
      actorUserId,
      status: "RST.BLOCKED_TECHNICAL",
      resultMessage: sourceError,
      exceptionCode: "ADAPTER_ERROR",
      memberVisible: true,
      internalNote,
    });
    return { status: "RST.BLOCKED_TECHNICAL", restored: false } as const;
  }

  if (!sourceExists) {
    await recordRestorationAttempt({
      decision,
      appealId: appealId ?? null,
      actorUserId,
      status: "RST.SOURCE_NO_LONGER_EXISTS",
      resultMessage: "The original source record no longer exists.",
      exceptionCode: "SOURCE_NOT_FOUND",
      memberVisible: true,
      internalNote,
    });
    return { status: "RST.SOURCE_NO_LONGER_EXISTS", restored: false } as const;
  }

  const decisionUpdate = await client
    .from("enforcement_decisions")
    .update({
      status: "reversed",
      resolved_at: now,
      reviewer_user_id: actorUserId,
      restoration_status: "RST.COMPLETED",
      restoration_note: memberMessage,
    })
    .eq("id", decision.id);
  if (decisionUpdate.error) throw decisionUpdate.error;

  await recordRestorationAttempt({
    decision,
    appealId: appealId ?? null,
    actorUserId,
    status: "RST.COMPLETED",
    resultMessage: memberMessage,
    memberVisible: true,
    internalNote,
  });

  return { status: "RST.COMPLETED", restored: true } as const;
}
