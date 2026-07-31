import "server-only";

export type FloorThesisAnalysisInput = {
  ticker: string;
  stance: string;
  conviction: number;
  horizon: string;
  entry_zone_low: number | null;
  entry_zone_high: number | null;
  exit_plan: string;
  thesis: string;
  catalysts: string;
  risks: string;
};

export type FloorThesisAnalysisResult = {
  steelman: string;
  redteam: string;
  blindSpots: string;
  model: string;
};

const FLOOR_ANALYSIS_MODEL = "claude-opus-5";

// Plain-language "return only JSON" + defensive fence-stripping on parse,
// not an API-level output_config.format constraint -- this matches the
// pattern already proven in production for Anthropic JSON responses in
// src/lib/moderation/ai-safety.ts, rather than a mechanism this file
// couldn't be tested against a live key before shipping.
const SYSTEM_PROMPT = `You are the red-team analyst for The Floor, an accountable-reasoning investing space inside Loombus.

Non-negotiable rule: you never issue a buy, sell, or hold recommendation, a price target, or any actionable trading advice. You do not rate the thesis on any numeric or letter scale. Your only job is to evaluate the QUALITY of the member's argument as written, from three angles:

- steelman: the strongest possible case FOR this thesis, as its most sophisticated advocate would argue it.
- redteam: the strongest possible case AGAINST this thesis -- real risks, weak assumptions, or the most likely ways it turns out wrong.
- blind_spots: something material this thesis does not address at all. Do not repeat the redteam here -- a blind spot is a silence, not a stated risk.

Return only valid JSON with exactly these keys: steelman, redteam, blind_spots. Each value is plain text (no markdown). Do not wrap the JSON in a code fence. Do not include any text before or after the JSON object. Do not include internal or system XML tags in your response. Never tell the reader what to do with their money.`;

function buildUserPrompt(thesis: FloorThesisAnalysisInput) {
  const entryZone =
    thesis.entry_zone_low !== null || thesis.entry_zone_high !== null
      ? `Entry zone: ${thesis.entry_zone_low ?? "n/a"} to ${thesis.entry_zone_high ?? "n/a"}`
      : "Entry zone: not specified";

  return [
    `Ticker: ${thesis.ticker}`,
    `Stance: ${thesis.stance}`,
    `Conviction: ${thesis.conviction}/5`,
    `Horizon: ${thesis.horizon}`,
    entryZone,
    `Exit plan: ${thesis.exit_plan}`,
    `Thesis: ${thesis.thesis}`,
    thesis.catalysts ? `Catalysts: ${thesis.catalysts}` : null,
    thesis.risks ? `Risks the author already named: ${thesis.risks}` : null,
    "",
    "Return JSON only:",
    '{"steelman": "...", "redteam": "...", "blind_spots": "..."}',
  ]
    .filter((line) => line !== null)
    .join("\n");
}

type AnthropicContentBlock = { type?: string; text?: string };

function stripJsonFence(rawText: string) {
  return rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function generateFloorThesisAnalysis(
  thesis: FloorThesisAnalysisInput
): Promise<FloorThesisAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI analysis is not configured yet.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: FLOOR_ANALYSIS_MODEL,
      // Thinking is on by default on Claude Opus 5 and shares max_tokens
      // with the response text -- for this bounded, well-specified critique
      // task we don't need it, and leaving it on risks the JSON output
      // getting truncated mid-string by the thinking budget (which throws
      // exactly the "not valid JSON" error this fixes). Disabling it is
      // valid at the default effort ("high"), so this doesn't 400.
      thinking: { type: "disabled" },
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(thesis) }],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || "Unable to generate the analysis.";
    throw new Error(message);
  }

  if (payload?.stop_reason === "refusal") {
    throw new Error("The analysis was declined. Try adjusting the thesis and try again.");
  }

  const textBlock = ((payload?.content ?? []) as AnthropicContentBlock[]).find(
    (block) => block?.type === "text" && typeof block?.text === "string"
  );

  if (!textBlock?.text) {
    throw new Error("The analysis returned no content.");
  }

  const cleaned = stripJsonFence(textBlock.text);

  let parsed: { steelman?: unknown; redteam?: unknown; blind_spots?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Logged (not thrown) so the raw model output is diagnosable from
    // server logs without exposing it in the user-facing error message.
    console.error(
      "[floor-ai-analysis] model response was not valid JSON after fence-stripping:",
      cleaned.slice(0, 1000)
    );
    throw new Error("The analysis response was not valid JSON.");
  }

  if (
    typeof parsed.steelman !== "string" ||
    typeof parsed.redteam !== "string" ||
    typeof parsed.blind_spots !== "string"
  ) {
    console.error(
      "[floor-ai-analysis] model response was valid JSON but missing a required key:",
      cleaned.slice(0, 1000)
    );
    throw new Error("The analysis response was missing a required section.");
  }

  return {
    steelman: parsed.steelman.trim(),
    redteam: parsed.redteam.trim(),
    blindSpots: parsed.blind_spots.trim(),
    model: FLOOR_ANALYSIS_MODEL,
  };
}
