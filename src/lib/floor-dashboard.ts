import type { FloorGraphRecord, FloorKnowledgeGraph } from "@/lib/floor-knowledge-graph";
import { buildFloorDiscoveryCompanies, dominantFloorDiscoveryStance, type FloorDiscoveryCompany } from "@/lib/floor-discovery";

export type FloorDashboardEventType = "thesis" | "evidence" | "risk" | "catalyst";

export type FloorDashboardEvent = {
  id: string;
  type: FloorDashboardEventType;
  title: string;
  detail: string;
  ticker: string;
  occurredAt: string | null;
  href: string | null;
};

export type FloorDashboardSummary = {
  companies: FloorDiscoveryCompany[];
  activeCompanies: FloorDiscoveryCompany[];
  topThemes: { id: string; label: string; count: number }[];
  topRisks: { id: string; label: string; count: number }[];
  topCatalysts: { id: string; label: string; count: number }[];
  events: FloorDashboardEvent[];
  totalTheses: number;
  totalAnalysts: number;
  totalEvidence: number;
  averageConviction: number | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function first(record: FloorGraphRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function recordTicker(record: FloorGraphRecord) {
  return text(first(record, ["ticker", "symbol", "company_ticker"])).toUpperCase();
}

function recordDate(record: FloorGraphRecord) {
  const value = text(first(record, ["updated_at", "published_at", "created_at"]));
  return Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function list(value: unknown) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const valueText = text(value);
  if (!valueText) return [];
  return valueText.split(/\n|;|•|\|/g).map((item) => item.replace(/^[-–—\s]+/, "").trim()).filter(Boolean);
}

export function buildFloorDashboard(graph: FloorKnowledgeGraph, records: FloorGraphRecord[], now = Date.now()): FloorDashboardSummary {
  const companies = buildFloorDiscoveryCompanies(graph, records, now).sort(
    (a, b) => b.momentumScore - a.momentumScore || b.activity30d - a.activity30d || a.ticker.localeCompare(b.ticker),
  );
  const activeCompanies = companies.filter((company) => company.activity30d > 0);
  const analystIds = new Set(graph.nodes.filter((node) => node.type === "analyst").map((node) => node.id));
  const convictions = companies.map((company) => company.averageConviction).filter((value): value is number => value !== null);
  const events: FloorDashboardEvent[] = [];

  for (const record of records.slice(0, 100)) {
    const ticker = recordTicker(record);
    const id = text(first(record, ["id", "thesis_id"]));
    if (!ticker || !id) continue;
    const title = text(first(record, ["title", "headline"])) || `${ticker} research thesis`;
    const occurredAt = recordDate(record);
    const href = `/the-floor/thesis/${encodeURIComponent(id)}`;
    events.push({ id: `thesis:${id}`, type: "thesis", title: "Thesis published or updated", detail: title, ticker, occurredAt, href });

    const evidence = Array.isArray(record.evidence) ? record.evidence : [];
    if (evidence.length) events.push({ id: `evidence:${id}`, type: "evidence", title: "Evidence disclosed", detail: `${evidence.length} evidence item${evidence.length === 1 ? "" : "s"} attached`, ticker, occurredAt, href });

    const risks = list(first(record, ["risks", "risk_factors", "primary_risk"]));
    if (risks.length) events.push({ id: `risk:${id}`, type: "risk", title: "Risk identified", detail: risks[0], ticker, occurredAt, href });

    const catalysts = list(first(record, ["catalysts", "catalyst"]));
    if (catalysts.length) events.push({ id: `catalyst:${id}`, type: "catalyst", title: "Catalyst identified", detail: catalysts[0], ticker, occurredAt, href });
  }

  events.sort((a, b) => Date.parse(b.occurredAt ?? "") - Date.parse(a.occurredAt ?? ""));

  return {
    companies,
    activeCompanies,
    topThemes: graph.themes.slice(0, 12).map(({ id, label, count }) => ({ id, label, count })),
    topRisks: graph.risks.slice(0, 12).map(({ id, label, count }) => ({ id, label, count })),
    topCatalysts: graph.catalysts.slice(0, 12).map(({ id, label, count }) => ({ id, label, count })),
    events: events.slice(0, 50),
    totalTheses: graph.nodes.filter((node) => node.type === "thesis").length,
    totalAnalysts: analystIds.size,
    totalEvidence: graph.nodes.filter((node) => node.type === "evidence").length,
    averageConviction: convictions.length ? Math.round(convictions.reduce((sum, value) => sum + value, 0) / convictions.length) : null,
  };
}

export function explainFloorCompany(company: FloorDiscoveryCompany) {
  return {
    stance: dominantFloorDiscoveryStance(company),
    reasons: [
      `${company.activity30d} thesis update${company.activity30d === 1 ? "" : "s"} in 30 days`,
      `${company.analystCount} observable analyst${company.analystCount === 1 ? "" : "s"}`,
      `${company.evidenceCount} cited evidence item${company.evidenceCount === 1 ? "" : "s"}`,
      `${company.catalystCount} catalyst${company.catalystCount === 1 ? "" : "s"}`,
      `${company.riskCount} disclosed risk${company.riskCount === 1 ? "" : "s"}`,
    ],
    disclaimer: "Research Momentum measures observable Floor activity. It is not price momentum, a forecast, or an investment recommendation.",
  };
}
