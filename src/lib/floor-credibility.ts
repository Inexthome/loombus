export type CredibilityThesis = {
  ticker: string;
  conviction: number;
  entry_zone_low: number | null;
  entry_zone_high: number | null;
  exit_plan: string | null;
  thesis: string | null;
  catalysts: string | null;
  risks: string | null;
  created_at: string;
  floor_calls?: Array<{
    status: "pending" | "resolved" | "void";
    outcome: "correct" | "incorrect" | "partial" | null;
    created_at: string;
    resolves_by: string;
  }> | null;
};

export type CredibilityDimensions = {
  accuracy: number;
  transparency: number;
  consistency: number;
  researchDepth: number;
  accountability: number;
  overall: number;
  confidence: "Emerging" | "Developing" | "Established" | "Excellent";
  resolvedCalls: number;
  pendingCalls: number;
  correctCalls: number;
  partialCalls: number;
  incorrectCalls: number;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function nonEmpty(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function calculateFloorCredibility(theses: CredibilityThesis[]): CredibilityDimensions {
  const calls = theses.flatMap((thesis) => thesis.floor_calls ?? []);
  const resolved = calls.filter((call) => call.status === "resolved");
  const pending = calls.filter((call) => call.status === "pending");
  const correct = resolved.filter((call) => call.outcome === "correct").length;
  const partial = resolved.filter((call) => call.outcome === "partial").length;
  const incorrect = resolved.filter((call) => call.outcome === "incorrect").length;

  // Matches public.floor_member_credibility exactly: correct / (correct +
  // incorrect), partial calls excluded from both sides (not half-credited),
  // 50 (neutral) only in the no-data case the view would return null for --
  // this and the view must never disagree on the same member's accuracy.
  const accuracyEligible = correct + incorrect;
  const accuracy = clamp(accuracyEligible > 0 ? (correct / accuracyEligible) * 100 : 50);

  const transparencyFields = theses.flatMap((thesis) => [
    thesis.entry_zone_low !== null || thesis.entry_zone_high !== null,
    nonEmpty(thesis.exit_plan),
    nonEmpty(thesis.catalysts),
    nonEmpty(thesis.risks),
    (thesis.floor_calls?.length ?? 0) > 0,
  ]);
  const transparency = clamp(
    transparencyFields.length > 0
      ? (transparencyFields.filter(Boolean).length / transparencyFields.length) * 100
      : 0
  );

  const uniqueMonths = new Set(
    theses.map((thesis) => {
      const date = new Date(thesis.created_at);
      return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    })
  ).size;
  const activityVolume = Math.min(1, theses.length / 24);
  const monthBreadth = Math.min(1, uniqueMonths / 12);
  const consistency = clamp((activityVolume * 0.45 + monthBreadth * 0.55) * 100);

  const depthValues = theses.map((thesis) => {
    const bodyLength = thesis.thesis?.trim().length ?? 0;
    const bodyScore = Math.min(1, bodyLength / 700);
    const supportingFields = [thesis.catalysts, thesis.risks, thesis.exit_plan].filter(nonEmpty).length / 3;
    const convictionDeclared = thesis.conviction >= 1 ? 1 : 0;
    return bodyScore * 0.5 + supportingFields * 0.4 + convictionDeclared * 0.1;
  });
  const researchDepth = clamp(
    depthValues.length > 0
      ? (depthValues.reduce((sum, value) => sum + value, 0) / depthValues.length) * 100
      : 0
  );

  // An admin void (bad market data, ambiguous target) isn't the author's
  // fault -- it shouldn't dent accountability the way a call that simply
  // never got resolved would, so voided calls are excluded from this rate's
  // denominator entirely rather than counted as unresolved.
  const resolvableCalls = calls.filter((call) => call.status !== "void");
  const callParticipation = theses.length > 0
    ? Math.min(1, calls.length / Math.max(theses.length, 1))
    : 0;
  const resolutionRate = resolvableCalls.length > 0 ? resolved.length / resolvableCalls.length : 0;
  const accountability = clamp((callParticipation * 0.45 + resolutionRate * 0.55) * 100);

  const overall = clamp(
    accuracy * 0.3 +
      transparency * 0.22 +
      consistency * 0.16 +
      researchDepth * 0.17 +
      accountability * 0.15
  );

  const confidence =
    overall >= 85
      ? "Excellent"
      : overall >= 70
        ? "Established"
        : overall >= 50
          ? "Developing"
          : "Emerging";

  return {
    accuracy,
    transparency,
    consistency,
    researchDepth,
    accountability,
    overall,
    confidence,
    resolvedCalls: resolved.length,
    pendingCalls: pending.length,
    correctCalls: correct,
    partialCalls: partial,
    incorrectCalls: incorrect,
  };
}

export function analystPath(memberId: string) {
  return `/the-floor/analyst/${encodeURIComponent(memberId)}`;
}
