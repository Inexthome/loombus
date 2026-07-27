export const ENFORCEMENT_TARGET_TYPES = [
  "account",
  "profile",
  "discussion",
  "reply",
  "message",
  "room",
  "marketplace",
  "business",
  "service",
  "request",
  "job",
  "event",
  "appointment",
] as const;

export type EnforcementTargetType = (typeof ENFORCEMENT_TARGET_TYPES)[number];

export const PUBLIC_REASON_LABELS = {
  R01: "Threat or violence",
  R02: "Child safety",
  R03: "Sexual exploitation or intimate imagery",
  R04: "Harassment or bullying",
  R05: "Hate or dehumanizing conduct",
  R06: "Suicide or self-harm concern",
  R07: "Personal information or privacy abuse",
  R08: "Scam, fraud, or impersonation",
  R09: "Spam or manipulation",
  R10: "Illegal or dangerous goods or services",
  R11: "Misleading AI or manipulated media",
  R12: "Intellectual property",
  R13: "Room governance or moderator conduct",
  R14: "Job, Service, Business, or professional claim",
  R15: "Account or security concern",
  R16: "Other policy concern",
} as const;

export type PublicReasonCode = keyof typeof PUBLIC_REASON_LABELS;

export const SEVERITY_LABELS = {
  S0: "No violation or informational",
  S1: "Low-severity or correctable",
  S2: "Material violation",
  S3: "High-risk violation",
  S4: "Severe violation",
  S5: "Critical or imminent risk",
} as const;

export type EnforcementSeverity = keyof typeof SEVERITY_LABELS;

export const CONFIDENCE_LABELS = {
  C0: "Unassessed or insufficient information",
  C1: "Weak signal",
  C2: "Plausible concern",
  C3: "More likely than not",
  C4: "Strong evidence",
  C5: "Verified by direct evidence",
} as const;

export type EnforcementConfidence = keyof typeof CONFIDENCE_LABELS;

export const APPEAL_OUTCOMES = [
  "APL.OUTCOME_UPHELD",
  "APL.OUTCOME_MODIFIED",
  "APL.OUTCOME_REVERSED",
  "APL.OUTCOME_REMANDED",
  "APL.OUTCOME_UNABLE_TO_REVIEW",
] as const;

export type AppealOutcome = (typeof APPEAL_OUTCOMES)[number];

export const APPEAL_OUTCOME_LABELS: Record<AppealOutcome, string> = {
  "APL.OUTCOME_UPHELD": "Upheld",
  "APL.OUTCOME_MODIFIED": "Modified",
  "APL.OUTCOME_REVERSED": "Reversed",
  "APL.OUTCOME_REMANDED": "Additional review required",
  "APL.OUTCOME_UNABLE_TO_REVIEW": "Unable to review",
};

export const APPEAL_OPEN_STATES = new Set([
  "APL.SUBMITTED",
  "APL.NEEDS_INFORMATION",
  "APL.QUEUED",
  "APL.UNDER_REVIEW",
  "APL.SPECIALIST_REVIEW",
  "APL.LEGAL_REVIEW",
]);

export const APPEAL_ELIGIBLE_STATES = new Set([
  "APL.ELIGIBLE",
  "APL.ELIGIBLE_AFTER_ACTION",
]);

export const ENFORCEMENT_ACTION_LABELS: Record<string, string> = {
  "ACT.NONE": "No action",
  "ACT.EDUCATION": "Education notice",
  "ACT.REVISION_REQUIRED": "Revision required",
  "ACT.RECOMMENDATION_EXCLUDE": "Removed from recommendations",
  "ACT.SEARCH_EXCLUDE": "Removed from Search",
  "ACT.FEATURED_SIGNAL_REMOVE": "Removed from Featured Signal",
  "ACT.CONTENT_HIDE": "Content hidden",
  "ACT.CONTENT_REMOVE": "Content removed",
  "ACT.ATTACHMENT_DISABLE": "Attachment disabled",
  "ACT.LINK_DISABLE": "Link disabled",
  "ACT.REPLY_RESTRICT": "Reply access restricted",
  "ACT.MESSAGE_RESTRICT": "Message access restricted",
  "ACT.FOLLOW_RESTRICT": "Follow access restricted",
  "ACT.UPLOAD_RESTRICT": "Upload access restricted",
  "ACT.REPORT_RESTRICT": "Reporting access restricted",
  "ACT.COMMERCE_RESTRICT": "Commerce access restricted",
  "ACT.ROOM_PRIVILEGE_RESTRICT": "Room privileges restricted",
  "ACT.AI_FEATURE_RESTRICT": "AI access restricted",
  "ACT.ACCOUNT_WARNING": "Account warning",
  "ACT.ACCOUNT_SUSPEND": "Account suspension",
  "ACT.ACCOUNT_REMOVE_PERMANENT": "Permanent account removal",
  "ACT.ROOM_CONTENT_ACTION": "Room content action",
  "ACT.ROOM_MEMBER_REMOVE": "Room member removed",
  "ACT.ROOM_MEMBER_BAN": "Room member banned",
  "ACT.ROOM_ROLE_REMOVE": "Room role removed",
  "ACT.ROOM_RESTRICT": "Room restricted",
  "ACT.ROOM_SUSPEND": "Room suspended",
  "ACT.ROOM_CLOSE": "Room closed",
  "ACT.ORGANIZATION_RESTRICT": "Organization restricted",
  "ACT.RECORD_CHANGES_REQUIRED": "Record changes required",
  "ACT.RECORD_SUSPEND": "Record suspended",
  "ACT.RECORD_ARCHIVE": "Record archived",
  "ACT.RECORD_REMOVE": "Record removed",
  "ACT.BUSINESS_RESTRICT": "Business restricted",
};

export type MemberEnforcementDecision = {
  id: string;
  targetType: EnforcementTargetType;
  targetId: string | null;
  targetLabel: string;
  policyDocumentId: string;
  policyVersion: string;
  publicReasonCode: PublicReasonCode;
  publicReasonLabel: string;
  primaryReasonCode: string;
  severity: EnforcementSeverity;
  actionCode: string;
  actionLabel: string;
  actionScope: string;
  memberExplanation: string;
  status: string;
  effectiveAt: string;
  expiresAt: string | null;
  resolvedAt: string | null;
  appealEligibility: string;
  appealDeadline: string | null;
  restorationStatus: string;
  restorationNote: string | null;
  createdAt: string;
  events: MemberEnforcementEvent[];
  appeal: MemberEnforcementAppeal | null;
};

export type MemberEnforcementEvent = {
  id: number;
  eventType: string;
  message: string | null;
  createdAt: string;
};

export type MemberEnforcementAppeal = {
  id: string;
  status: string;
  outcome: AppealOutcome | null;
  statement: string;
  additionalContext: string | null;
  hasNewInformation: boolean;
  memberOutcomeMessage: string | null;
  submittedAt: string;
  reviewStartedAt: string | null;
  decidedAt: string | null;
  closedAt: string | null;
};

export const TARGET_INTEGRATION_STATUS: Record<
  EnforcementTargetType,
  { decision: "automatic" | "manual"; restoration: "automatic" | "manual" }
> = {
  account: { decision: "automatic", restoration: "automatic" },
  discussion: { decision: "automatic", restoration: "automatic" },
  reply: { decision: "automatic", restoration: "automatic" },
  profile: { decision: "manual", restoration: "manual" },
  message: { decision: "manual", restoration: "manual" },
  room: { decision: "manual", restoration: "manual" },
  marketplace: { decision: "manual", restoration: "manual" },
  business: { decision: "manual", restoration: "manual" },
  service: { decision: "manual", restoration: "manual" },
  request: { decision: "manual", restoration: "manual" },
  job: { decision: "manual", restoration: "manual" },
  event: { decision: "manual", restoration: "manual" },
  appointment: { decision: "manual", restoration: "manual" },
};

export function isPublicReasonCode(value: unknown): value is PublicReasonCode {
  return typeof value === "string" && value in PUBLIC_REASON_LABELS;
}

export function isEnforcementTargetType(value: unknown): value is EnforcementTargetType {
  return (
    typeof value === "string" &&
    (ENFORCEMENT_TARGET_TYPES as readonly string[]).includes(value)
  );
}

export function isEnforcementSeverity(value: unknown): value is EnforcementSeverity {
  return typeof value === "string" && value in SEVERITY_LABELS;
}

export function isEnforcementConfidence(value: unknown): value is EnforcementConfidence {
  return typeof value === "string" && value in CONFIDENCE_LABELS;
}

export function isAppealOutcome(value: unknown): value is AppealOutcome {
  return (
    typeof value === "string" &&
    (APPEAL_OUTCOMES as readonly string[]).includes(value)
  );
}

export function getActionLabel(actionCode: string) {
  return ENFORCEMENT_ACTION_LABELS[actionCode] ?? actionCode.replaceAll("_", " ");
}
