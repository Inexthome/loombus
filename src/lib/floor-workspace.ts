export type WorkspaceEvidenceType =
  | "sec_filing"
  | "earnings_report"
  | "investor_presentation"
  | "conference_call"
  | "external_article"
  | "financial_model"
  | "chart"
  | "personal_observation";

export type WorkspaceEvidence = {
  id: string;
  type: WorkspaceEvidenceType;
  title: string;
  url: string;
  note: string;
  createdAt: string;
};

export type WorkspaceDraft = {
  id: string;
  title: string;
  ticker: string;
  thesis: string;
  businessOverview: string;
  valuation: string;
  catalysts: string;
  risks: string;
  counterarguments: string;
  entryConditions: string;
  exitConditions: string;
  timeHorizon: string;
  confidence: number;
  evidence: WorkspaceEvidence[];
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceRevision = {
  id: string;
  draftId: string;
  savedAt: string;
  summary: string;
  snapshot: WorkspaceDraft;
};

export const FLOOR_WORKSPACE_DRAFTS_KEY = "loombus.floor.workspace.drafts.v1";
export const FLOOR_WORKSPACE_REVISIONS_KEY = "loombus.floor.workspace.revisions.v1";

export function createWorkspaceDraft(): WorkspaceDraft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "Untitled research",
    ticker: "",
    thesis: "",
    businessOverview: "",
    valuation: "",
    catalysts: "",
    risks: "",
    counterarguments: "",
    entryConditions: "",
    exitConditions: "",
    timeHorizon: "",
    confidence: 50,
    evidence: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeWorkspaceTicker(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12);
}

function hasText(value: string, minimum = 20) {
  return value.trim().length >= minimum;
}

export type WorkspaceQuality = {
  score: number;
  label: "Early" | "Developing" | "Strong" | "Excellent";
  dimensions: Array<{ label: string; score: number }>;
  missing: string[];
  ready: boolean;
};

export function calculateWorkspaceQuality(draft: WorkspaceDraft): WorkspaceQuality {
  const completenessChecks = [
    hasText(draft.thesis, 60),
    hasText(draft.businessOverview, 40),
    hasText(draft.catalysts, 30),
    hasText(draft.risks, 30),
    hasText(draft.counterarguments, 30),
    hasText(draft.entryConditions, 20),
    hasText(draft.exitConditions, 20),
    hasText(draft.timeHorizon, 5),
  ];
  const completeness = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100);
  const evidence = Math.min(100, draft.evidence.length * 25);
  const riskDisclosure = hasText(draft.risks, 80) ? 100 : hasText(draft.risks, 30) ? 65 : 0;
  const counterargument = hasText(draft.counterarguments, 80) ? 100 : hasText(draft.counterarguments, 30) ? 65 : 0;
  const valuation = hasText(draft.valuation, 60) ? 100 : hasText(draft.valuation, 20) ? 55 : 0;
  const exitStrategy = hasText(draft.exitConditions, 40) ? 100 : hasText(draft.exitConditions, 20) ? 60 : 0;
  const score = Math.round(
    completeness * 0.28 + evidence * 0.2 + riskDisclosure * 0.15 + counterargument * 0.12 + valuation * 0.12 + exitStrategy * 0.13
  );
  const missing: string[] = [];
  if (!hasText(draft.thesis, 60)) missing.push("A clear, falsifiable investment thesis");
  if (!hasText(draft.risks, 30)) missing.push("Primary risks");
  if (!hasText(draft.counterarguments, 30)) missing.push("A serious counterargument");
  if (!hasText(draft.exitConditions, 20)) missing.push("Exit or invalidation conditions");
  if (!hasText(draft.valuation, 20)) missing.push("Valuation framework");
  if (draft.evidence.length === 0) missing.push("At least one evidence item");
  const label = score >= 85 ? "Excellent" : score >= 70 ? "Strong" : score >= 45 ? "Developing" : "Early";
  return {
    score,
    label,
    dimensions: [
      { label: "Completeness", score: completeness },
      { label: "Evidence", score: evidence },
      { label: "Risk disclosure", score: riskDisclosure },
      { label: "Counterarguments", score: counterargument },
      { label: "Valuation", score: valuation },
      { label: "Exit strategy", score: exitStrategy },
    ],
    missing,
    ready: missing.length === 0 && score >= 70,
  };
}

export function createWorkspaceRevision(draft: WorkspaceDraft, previous?: WorkspaceDraft): WorkspaceRevision {
  const changed = previous
    ? Object.keys(draft).filter((key) => JSON.stringify(draft[key as keyof WorkspaceDraft]) !== JSON.stringify(previous[key as keyof WorkspaceDraft]))
    : ["Initial draft"];
  return {
    id: crypto.randomUUID(),
    draftId: draft.id,
    savedAt: new Date().toISOString(),
    summary: changed.length === 1 && changed[0] === "Initial draft" ? "Initial draft" : `Updated ${changed.filter((key) => !["updatedAt", "id"].includes(key)).join(", ") || "draft"}`,
    snapshot: structuredClone(draft),
  };
}
