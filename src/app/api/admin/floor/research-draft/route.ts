import { NextResponse, type NextRequest } from "next/server";
import { createFloorRequestSupabase } from "@/lib/floor-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RESEARCH_MODEL =
  process.env.OPENAI_RESEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-5.6";
const PROMPT_VERSION = "floor-research-desk-v1";

type ResearchDraft = {
  title?: unknown;
  excerpt?: unknown;
  body?: unknown;
  tickers?: unknown;
  sources?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseDraft(value: string): ResearchDraft {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse(fenced ?? trimmed) as ResearchDraft;
}

function responseText(result: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}) {
  if (result.output_text) return result.output_text;
  return (result.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text)
    .join("\n");
}

export async function POST(request: NextRequest) {
  if (!OPENAI_API_KEY) {
    return jsonError("OpenAI research is not configured.", 503);
  }

  let supabase;
  try {
    supabase = createFloorRequestSupabase(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const access = await verifyRequestAccountAccess(supabase);
  if (!access.ok) {
    return jsonError(access.error, access.status);
  }
  if (!access.profile.is_admin) {
    return jsonError("Admin access required.", 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const title = cleanString(payload.title, 180);
  const focus = cleanString(payload.focus, 1200);
  const publicationType = cleanString(payload.publicationType, 80);
  const tickers = cleanString(payload.tickers, 240);

  if (!title || !focus) {
    return jsonError("A working title and research brief are required.", 400);
  }

  const prompt = `Prepare a rigorous Loombus Research Desk draft for human review.

Working title: ${title}
Publication type: ${publicationType || "research briefing"}
Research brief: ${focus}
Relevant tickers: ${tickers || "Determine from the research"}

Research current, credible public sources using web search. Prefer primary sources such as issuer filings, investor-relations releases, regulators, exchanges, and official datasets. Clearly distinguish reported facts from analysis, surface material counter-evidence and uncertainty, and never invent a fact, quote, number, or URL. This is research, not personalized investment advice and not a buy or sell recommendation.

Return only valid JSON with this exact shape:
{
  "title": "publication title",
  "excerpt": "two or three sentence executive summary",
  "body": "publication-ready Markdown with headings for Key findings, Evidence, Counterpoints and risks, and What to watch",
  "tickers": ["TICKER"],
  "sources": [{"url": "https://...", "title": "source title"}]
}

Every material claim in the body must be supportable by at least one listed source. Include only URLs you actually consulted.`;

  let openAiResponse: Response;
  try {
    openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: RESEARCH_MODEL,
        tools: [{ type: "web_search" }],
        input: prompt,
        max_output_tokens: 7000,
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    return jsonError("The research service did not respond.", 502);
  }

  const result = (await openAiResponse.json().catch(() => null)) as {
    error?: { message?: string };
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  } | null;

  if (!openAiResponse.ok) {
    return jsonError(
      result?.error?.message || "The research service rejected the request.",
      502,
    );
  }

  let draft: ResearchDraft;
  try {
    draft = parseDraft(result ? responseText(result) : "");
  } catch {
    return jsonError("The research service returned an invalid draft.", 502);
  }

  const sourceRows = Array.isArray(draft.sources) ? draft.sources : [];
  const sources = sourceRows
    .map((source) => {
      if (!source || typeof source !== "object") return null;
      const row = source as { url?: unknown; title?: unknown };
      const url = cleanString(row.url, 2000);
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) return null;
      } catch {
        return null;
      }
      return { url, title: cleanString(row.title, 300) };
    })
    .filter((source): source is { url: string; title: string } =>
      Boolean(source),
    )
    .filter(
      (source, index, all) =>
        all.findIndex((item) => item.url === source.url) === index,
    )
    .slice(0, 30);

  const body = cleanString(draft.body, 40_000);
  const excerpt = cleanString(draft.excerpt, 1000);
  if (!body || !excerpt || sources.length === 0) {
    return jsonError(
      "The draft was incomplete or did not include sources.",
      502,
    );
  }

  const draftTickers = Array.isArray(draft.tickers)
    ? draft.tickers
        .map((ticker) => cleanString(ticker, 12).toUpperCase())
        .filter(Boolean)
        .slice(0, 20)
    : [];

  return NextResponse.json(
    {
      draft: {
        title: cleanString(draft.title, 180) || title,
        excerpt,
        body,
        tickers: draftTickers,
        sources,
      },
      provenance: {
        provider: "openai",
        model: RESEARCH_MODEL,
        promptVersion: PROMPT_VERSION,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
