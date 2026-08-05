import { getFloorCompany, normalizeFloorTicker } from "@/lib/floor-companies";

export type FloorGraphNodeType =
  | "company"
  | "thesis"
  | "analyst"
  | "catalyst"
  | "risk"
  | "theme"
  | "evidence";

export type FloorGraphNode = {
  id: string;
  type: FloorGraphNodeType;
  label: string;
  subtitle: string | null;
  href: string | null;
  count: number;
};

export type FloorGraphEdge = {
  id: string;
  source: string;
  target: string;
  relation:
    | "covers"
    | "authored"
    | "cites"
    | "identifies_catalyst"
    | "identifies_risk"
    | "shares_theme";
};

export type FloorGraphRecord = Record<string, unknown>;

export type FloorKnowledgeGraph = {
  nodes: FloorGraphNode[];
  edges: FloorGraphEdge[];
  companies: FloorGraphNode[];
  themes: FloorGraphNode[];
  risks: FloorGraphNode[];
  catalysts: FloorGraphNode[];
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const valueText = text(value);
  if (!valueText) return [];
  return valueText
    .split(/\n|;|•|\|/g)
    .map((item) => item.replace(/^[-–—\s]+/, "").trim())
    .filter((item) => item.length >= 3);
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function first(record: FloorGraphRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function extractThemes(record: FloorGraphRecord) {
  const explicit = stringList(first(record, ["themes", "tags", "topics", "sectors"]));
  if (explicit.length) return explicit.slice(0, 8);

  const source = [
    text(first(record, ["title", "headline"])),
    text(first(record, ["thesis", "body", "summary", "investment_thesis"])),
  ]
    .join(" ")
    .toLowerCase();

  const dictionary = [
    "artificial intelligence",
    "cloud computing",
    "semiconductors",
    "data center",
    "energy demand",
    "supply chain",
    "consumer spending",
    "interest rates",
    "cybersecurity",
    "electric vehicles",
  ];

  return dictionary.filter((item) => source.includes(item));
}

export function buildFloorKnowledgeGraph(records: FloorGraphRecord[]): FloorKnowledgeGraph {
  const nodes = new Map<string, FloorGraphNode>();
  const edges = new Map<string, FloorGraphEdge>();

  function addNode(node: FloorGraphNode) {
    const existing = nodes.get(node.id);
    nodes.set(node.id, existing ? { ...existing, count: existing.count + 1 } : node);
  }

  function addEdge(edge: FloorGraphEdge) {
    edges.set(edge.id, edge);
  }

  for (const record of records) {
    const rawTicker = text(first(record, ["ticker", "symbol", "company_ticker"]));
    const ticker = normalizeFloorTicker(rawTicker);
    const thesisId = text(first(record, ["id", "thesis_id"]));
    if (!ticker || !thesisId) continue;

    const company = getFloorCompany(ticker);
    const companyId = `company:${ticker}`;
    const thesisNodeId = `thesis:${thesisId}`;
    const title = text(first(record, ["title", "headline"])) || `${ticker} research thesis`;
    const authorId = text(first(record, ["user_id", "author_id", "member_id", "profile_id"]));
    const authorName =
      text(first(record, ["author_name", "full_name", "username", "display_name"])) || "Floor analyst";

    addNode({
      id: companyId,
      type: "company",
      label: ticker,
      subtitle: company.name === ticker ? null : company.name,
      href: `/the-floor/company/${encodeURIComponent(ticker)}`,
      count: 1,
    });
    addNode({
      id: thesisNodeId,
      type: "thesis",
      label: title,
      subtitle: ticker,
      href: `/the-floor/thesis/${encodeURIComponent(thesisId)}`,
      count: 1,
    });
    addEdge({
      id: `${thesisNodeId}->${companyId}:covers`,
      source: thesisNodeId,
      target: companyId,
      relation: "covers",
    });

    if (authorId) {
      const analystId = `analyst:${authorId}`;
      addNode({
        id: analystId,
        type: "analyst",
        label: authorName,
        subtitle: "Analyst",
        href: `/the-floor/analyst/${encodeURIComponent(authorId)}`,
        count: 1,
      });
      addEdge({
        id: `${analystId}->${thesisNodeId}:authored`,
        source: analystId,
        target: thesisNodeId,
        relation: "authored",
      });
    }

    for (const catalyst of stringList(first(record, ["catalysts", "catalyst"])).slice(0, 8)) {
      const catalystId = `catalyst:${slug(catalyst)}`;
      addNode({ id: catalystId, type: "catalyst", label: catalyst, subtitle: "Catalyst", href: null, count: 1 });
      addEdge({
        id: `${thesisNodeId}->${catalystId}:identifies_catalyst`,
        source: thesisNodeId,
        target: catalystId,
        relation: "identifies_catalyst",
      });
    }

    for (const risk of stringList(first(record, ["risks", "risk_factors", "primary_risk"])).slice(0, 8)) {
      const riskId = `risk:${slug(risk)}`;
      addNode({ id: riskId, type: "risk", label: risk, subtitle: "Risk", href: null, count: 1 });
      addEdge({
        id: `${thesisNodeId}->${riskId}:identifies_risk`,
        source: thesisNodeId,
        target: riskId,
        relation: "identifies_risk",
      });
    }

    for (const theme of extractThemes(record)) {
      const themeId = `theme:${slug(theme)}`;
      addNode({ id: themeId, type: "theme", label: theme, subtitle: "Theme", href: null, count: 1 });
      addEdge({
        id: `${companyId}->${themeId}:shares_theme`,
        source: companyId,
        target: themeId,
        relation: "shares_theme",
      });
    }

    const evidenceItems = Array.isArray(record.evidence) ? record.evidence : [];
    for (const evidence of evidenceItems.slice(0, 12)) {
      if (!evidence || typeof evidence !== "object") continue;
      const evidenceRecord = evidence as FloorGraphRecord;
      const evidenceTitle = text(first(evidenceRecord, ["title", "label", "name"]));
      if (!evidenceTitle) continue;
      const evidenceId = `evidence:${slug(evidenceTitle)}`;
      addNode({
        id: evidenceId,
        type: "evidence",
        label: evidenceTitle,
        subtitle: text(first(evidenceRecord, ["type", "source_type"])) || "Evidence",
        href: text(first(evidenceRecord, ["url", "source_url"])) || null,
        count: 1,
      });
      addEdge({
        id: `${thesisNodeId}->${evidenceId}:cites`,
        source: thesisNodeId,
        target: evidenceId,
        relation: "cites",
      });
    }
  }

  const values = [...nodes.values()];
  const ranked = (type: FloorGraphNodeType) =>
    values.filter((node) => node.type === type).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    nodes: values,
    edges: [...edges.values()],
    companies: ranked("company"),
    themes: ranked("theme"),
    risks: ranked("risk"),
    catalysts: ranked("catalyst"),
  };
}

export function connectedFloorNodes(graph: FloorKnowledgeGraph, nodeId: string) {
  const connectedIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source === nodeId) connectedIds.add(edge.target);
    if (edge.target === nodeId) connectedIds.add(edge.source);
  }
  return graph.nodes.filter((node) => connectedIds.has(node.id));
}
