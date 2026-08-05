import { getFloorCompany, normalizeFloorTicker } from "@/lib/floor-companies";

export type ResearchAssistantThesis = {
  id: string;
  ticker: string;
  stance: "long" | "short" | "neutral";
  conviction: number;
  thesis: string;
  catalysts: string;
  risks: string;
  exit_plan: string;
  created_at: string;
  floor_calls?: Array<{
    status: "pending" | "resolved" | "void";
    outcome: "correct" | "incorrect" | "partial" | null;
  }> | null;
};

export type ResearchAssistantBrief = {
  ticker: string;
  companyName: string;
  thesisCount: number;
  stance: { bull: number; bear: number; neutral: number };
  averageConviction: number | null;
  catalysts: string[];
  risks: string[];
  unresolvedQuestions: string[];
  accountability: { resolved: number; correct: number; incorrect: number; partial: number };
  synthesis: string;
};

function uniqueLines(values: string[], limit = 5) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    for (const line of value.split(/\n|[.;]\s+/)) {
      const normalized = line.trim();
      const key = normalized.toLowerCase();
      if (normalized.length < 12 || seen.has(key)) continue;
      seen.add(key);
      output.push(normalized);
      if (output.length >= limit) return output;
    }
  }
  return output;
}

export function buildResearchAssistantBrief(
  rawTicker: string,
  theses: ResearchAssistantThesis[]
): ResearchAssistantBrief {
  const ticker = normalizeFloorTicker(rawTicker);
  const company = getFloorCompany(ticker);
  const relevant = theses.filter((thesis) => normalizeFloorTicker(thesis.ticker) === ticker);
  const bull = relevant.filter((thesis) => thesis.stance === "long").length;
  const bear = relevant.filter((thesis) => thesis.stance === "short").length;
  const neutral = relevant.filter((thesis) => thesis.stance === "neutral").length;
  const averageConviction = relevant.length
    ? Math.round((relevant.reduce((sum, thesis) => sum + thesis.conviction, 0) / relevant.length) * 10) / 10
    : null;
  const calls = relevant.flatMap((thesis) => thesis.floor_calls ?? []);
  const resolved = calls.filter((call) => call.status === "resolved");
  const catalysts = uniqueLines(relevant.map((thesis) => thesis.catalysts));
  const risks = uniqueLines(relevant.map((thesis) => thesis.risks));
  const unresolvedQuestions = uniqueLines(
    relevant.flatMap((thesis) => [
      thesis.exit_plan ? `What evidence would trigger the stated exit plan: ${thesis.exit_plan}` : "",
      thesis.risks ? `Which disclosed risk is most likely to invalidate the thesis: ${thesis.risks}` : "",
    ]),
    4
  );

  let synthesis = `The Floor currently has no published research for ${ticker}.`;
  if (relevant.length) {
    const balance = bull === bear ? "evenly divided" : bull > bear ? "weighted toward bullish research" : "weighted toward bearish research";
    synthesis = `${company.name} has ${relevant.length} published ${relevant.length === 1 ? "thesis" : "theses"}. Coverage is ${balance}, with ${bull} bullish, ${bear} bearish, and ${neutral} neutral. The assistant is summarizing member-published evidence and recorded outcomes, not issuing an investment rating.`;
  }

  return {
    ticker,
    companyName: company.name,
    thesisCount: relevant.length,
    stance: { bull, bear, neutral },
    averageConviction,
    catalysts,
    risks,
    unresolvedQuestions,
    accountability: {
      resolved: resolved.length,
      correct: resolved.filter((call) => call.outcome === "correct").length,
      incorrect: resolved.filter((call) => call.outcome === "incorrect").length,
      partial: resolved.filter((call) => call.outcome === "partial").length,
    },
    synthesis,
  };
}
