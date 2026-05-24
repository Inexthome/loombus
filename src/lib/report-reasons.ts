export const REPORT_REASONS = [
  "Spam, scam, or misleading link",
  "Harassment, intimidation, or targeted abuse",
  "Hate, dehumanization, or protected-group attack",
  "Threat, violence, self-harm, or dangerous content",
  "Privacy violation, doxxing, or personal information",
  "Impersonation, fake identity, or deceptive profile",
  "Misinformation, manipulation, or coordinated deception",
  "Sexual, exploitative, or non-consensual content",
  "Intellectual property or rights concern",
  "Illegal activity or platform abuse",
  "Other policy or safety concern",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const DEFAULT_REPORT_REASON: ReportReason = REPORT_REASONS[0];
