export const REPORT_REASONS = [
  "Spam or misleading content",
  "Harassment or abusive behavior",
  "Hate or discriminatory content",
  "Sexual or explicit content",
  "Violence or threat",
  "Privacy or personal information",
  "Impersonation or fake profile",
  "Other moderation concern",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const DEFAULT_REPORT_REASON: ReportReason = REPORT_REASONS[0];
