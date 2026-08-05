import type { FloorGraphNode, FloorGraphRecord, FloorKnowledgeGraph } from "@/lib/floor-knowledge-graph";

export type FloorDiscoveryStance = "bullish" | "bearish" | "neutral" | "unknown";

export type FloorDiscoveryCompany = {
  id: string;
  ticker: string;
  name: string | null;
  href: string | null;
  thesisCount: number;
  analystCount: number;
  evidenceCount: number;
  catalystCount: number;
  riskCount: number;
  themeCount: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  averageConviction: number | null;
  activity30d: number;
  latestActivityAt: string | null;
  momentumScore: number;
  themes: FloorGraphNode[];
  risks: FloorGraphNode[];
  catalysts: FloorGraphNode[];
};

export type FloorDiscoveryFilters = {
  query: string;
  minimumTheses: number;
  minimumAnalysts: number;
  minimumEvidence: number;
  minimumConviction: number;
  stance: "all" | Exclude<FloorDiscoveryStance, "unknown">;
  themeId: string;
  riskId: string;
  catalystId: string;
  activeOnly: boolean;
};

export type FloorSavedScreen = {
  id: string;
  name: string;
  createdAt: string;
  filters: FloorDiscoveryFilters;
};

const DEFAULT_FILTERS: FloorDiscoveryFilters = {
  query: "",
  minimumTheses: 0,
  minimumAnalysts: 0,
  minimumEvidence: 0,
  minimumConviction: 0,
  stance: "all",
  themeId: "",
  riskId: "",
  catalystId: "",
  activeOnly: false,
};

export function defaultFloorDiscoveryFilters() {
  return { ...DEFAULT_FILTERS };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function first(record: FloorGraphRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function normalizeStance(record: FloorGraphRecord): FloorDiscoveryStance {
  const source = text(first(record, ["stance", "position", "rating", "outlook", "sentiment"])).toLowerCase();
  if (["bullish", "bull", "long", "positive", "outperform", "overweight"].some((term) => source.includes(term))) return "bullish";
  if (["bearish", "bear", "short", "negative", "underperform", "underweight"].some((term) => source.includes(term))) return "bearish";
  if (["neutral", "mixed", "hold", "market perform", "equal weight"].some((term) => source.includes(term))) return "neutral";
  return "unknown";
}

function conviction(record: FloorGraphRecord) {
  const raw = numberValue(first(record, ["conviction", "confidence", "confidence_score", "conviction_score"]));
  if (raw === null) return null;
  if (raw <= 1) return Math.round(raw * 100);
  if (raw <= 10) return Math.round(raw * 10);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function createdAt(record: FloorGraphRecord) {
  const value = text(first(record, ["updated_at", "published_at", "created_at"]));
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function connectedNodes(graph: FloorKnowledgeGraph, nodeId: string, type?: FloorGraphNode["type"]) {
  const ids = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source === nodeId) ids.add(edge.target);
    if (edge.target === nodeId) ids.add(edge.source);
  }
  return graph.nodes.filter((node) => ids.has(node.id) && (!type || node.type === type));
}

function thesisRecordsForCompany(records: FloorGraphRecord[], ticker: string) {
  return records.filter((record) => text(first(record, ["ticker", "symbol", "company_ticker"])).toUpperCase() === ticker);
}

export function buildFloorDiscoveryCompanies(graph: FloorKnowledgeGraph, records: FloorGraphRecord[], now = Date.now()) {
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  return graph.companies.map<FloorDiscoveryCompany>((company) => {
    const ticker = company.label.toUpperCase();
    const companyRecords = thesisRecordsForCompany(records, ticker);
    const thesisNodes = connectedNodes(graph, company.id, "thesis");
    const analystIds = new Set<string>();
    const evidenceIds = new Set<string>();
    const catalysts = new Map<string, FloorGraphNode>();
    const risks = new Map<string, FloorGraphNode>();
    const themes = new Map<string, FloorGraphNode>();

    for (const thesis of thesisNodes) {
      for (const node of connectedNodes(graph, thesis.id)) {
        if (node.type === "analyst") analystIds.add(node.id);
        if (node.type === "evidence") evidenceIds.add(node.id);
        if (node.type === "catalyst") catalysts.set(node.id, node);
        if (node.type === "risk") risks.set(node.id, node);
      }
    }
    for (const node of connectedNodes(graph, company.id, "theme")) themes.set(node.id, node);

    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;
    const convictions: number[] = [];
    let activity30d = 0;
    let latestActivity = 0;

    for (const record of companyRecords) {
      const stance = normalizeStance(record);
      if (stance === "bullish") bullishCount += 1;
      if (stance === "bearish") bearishCount += 1;
      if (stance === "neutral") neutralCount += 1;
      const score = conviction(record);
      if (score !== null) convictions.push(score);
      const timestamp = createdAt(record);
      if (timestamp !== null) {
        latestActivity = Math.max(latestActivity, timestamp);
        if (now - timestamp <= thirtyDays) activity30d += 1;
      }
    }

    const averageConviction = convictions.length
      ? Math.round(convictions.reduce((sum, score) => sum + score, 0) / convictions.length)
      : null;
    const momentumScore = Math.min(100, Math.round(activity30d * 18 + analystIds.size * 8 + evidenceIds.size * 4 + catalysts.size * 3 + risks.size * 2));

    return {
      id: company.id,
      ticker,
      name: company.subtitle,
      href: company.href,
      thesisCount: thesisNodes.length,
      analystCount: analystIds.size,
      evidenceCount: evidenceIds.size,
      catalystCount: catalysts.size,
      riskCount: risks.size,
      themeCount: themes.size,
      bullishCount,
      bearishCount,
      neutralCount,
      averageConviction,
      activity30d,
      latestActivityAt: latestActivity ? new Date(latestActivity).toISOString() : null,
      momentumScore,
      themes: [...themes.values()].sort((a, b) => b.count - a.count),
      risks: [...risks.values()].sort((a, b) => b.count - a.count),
      catalysts: [...catalysts.values()].sort((a, b) => b.count - a.count),
    };
  });
}

export function dominantFloorDiscoveryStance(company: FloorDiscoveryCompany) {
  const values = [
    ["bullish", company.bullishCount],
    ["bearish", company.bearishCount],
    ["neutral", company.neutralCount],
  ] as const;
  const ranked = [...values].sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[1] ? ranked[0][0] : "unknown";
}

export function filterFloorDiscoveryCompanies(companies: FloorDiscoveryCompany[], filters: FloorDiscoveryFilters) {
  const query = filters.query.trim().toLowerCase();
  return companies
    .filter((company) => {
      if (query && !`${company.ticker} ${company.name ?? ""}`.toLowerCase().includes(query)) return false;
      if (company.thesisCount < filters.minimumTheses) return false;
      if (company.analystCount < filters.minimumAnalysts) return false;
      if (company.evidenceCount < filters.minimumEvidence) return false;
      if ((company.averageConviction ?? 0) < filters.minimumConviction) return false;
      if (filters.stance !== "all" && dominantFloorDiscoveryStance(company) !== filters.stance) return false;
      if (filters.themeId && !company.themes.some((node) => node.id === filters.themeId)) return false;
      if (filters.riskId && !company.risks.some((node) => node.id === filters.riskId)) return false;
      if (filters.catalystId && !company.catalysts.some((node) => node.id === filters.catalystId)) return false;
      if (filters.activeOnly && company.activity30d === 0) return false;
      return true;
    })
    .sort((a, b) => b.momentumScore - a.momentumScore || b.thesisCount - a.thesisCount || a.ticker.localeCompare(b.ticker));
}

export function describeFloorDiscoveryScreen(filters: FloorDiscoveryFilters) {
  const parts: string[] = [];
  if (filters.query.trim()) parts.push(`matching “${filters.query.trim()}”`);
  if (filters.minimumTheses) parts.push(`${filters.minimumTheses}+ theses`);
  if (filters.minimumAnalysts) parts.push(`${filters.minimumAnalysts}+ analysts`);
  if (filters.minimumEvidence) parts.push(`${filters.minimumEvidence}+ evidence items`);
  if (filters.minimumConviction) parts.push(`${filters.minimumConviction}+ conviction`);
  if (filters.stance !== "all") parts.push(`${filters.stance} balance`);
  if (filters.activeOnly) parts.push("active in 30 days");
  return parts.length ? parts.join(" · ") : "All observable Floor research";
}
