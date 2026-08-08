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

const FLOOR_ANALYSIS_MODEL =
  process.env.OPENAI_FLOOR_ANALYSIS_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-5.6";

const SYSTEM_PROMPT = `You are the red-team analyst for The Floor, an accountable-reasoning investing space inside Loombus.

Non-negotiable rule: you never issue a buy, sell, or hold recommendation, a price target, or any actionable trading advice. You do not rate the thesis on any numeric or letter scale. Your only job is to evaluate the QUALITY of the member's argument as written, from three angles:

- steelman: the strongest possible case FOR this thesis, as its most sophisticated advocate would argue it.
- redteam: the strongest possible case AGAINST this thesis -- real risks, weak assumptions, or the most likely ways it turns out wrong.
- blind_spots: something material this thesis does not address at all. Do not repeat the redteam here -- a blind spot is a silence, not a stated risk.

Return only the requested structured fields. Each value must be plain text with no markdown. Never tell the reader what to do with their money.`;

const FLOOR_ANALYSIS_RESPONSE_SCHEMA = {
  name: "floor_thesis_red_team_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      steelman: { type: "string" },
      redteam: { type: "string" },
      blind_spots: { type: "string" },
    },
    required: ["steelman", "redteam", "blind_spots"],
    additionalProperties: false,
  },
} as const;

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
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export async function generateFloorThesisAnalysis(
  thesis: FloorThesisAnalysisInput
): Promise<FloorThesisAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI analysis is not configured yet.");
  }

  const timeout = AbortSignal.timeout(30_000);

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FLOOR_ANALYSIS_MODEL,
        store: false,
        max_completion_tokens: 3000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(thesis) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: FLOOR_ANALYSIS_RESPONSE_SCHEMA,
        },
      }),
      signal: timeout,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("The analysis took too long to generate. Try again.");
    }
    throw error;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error?.message || "Unable to generate the analysis.";
    throw new Error(message);
  }

  const choice = payload?.choices?.[0];
  const message = choice?.message;

  if (choice?.finish_reason === "length") {
    throw new Error("The analysis response was incomplete. Try again.");
  }

  if (typeof message?.refusal === "string" && message.refusal.trim()) {
    throw new Error("The analysis was declined. Try adjusting the thesis and try again.");
  }

  const rawText = message?.content;
  if (typeof rawText !== "string" || !rawText.trim()) {
    throw new Error("The analysis returned no content.");
  }

  let parsed: { steelman?: unknown; redteam?: unknown; blind_spots?: unknown };
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Do not log model output here. Thesis content and generated analysis can
    // contain member-provided material, so diagnostics remain metadata-only.
    console.error("[floor-ai-analysis] OpenAI returned invalid structured JSON");
    throw new Error("The analysis response was not valid JSON.");
  }

  if (
    typeof parsed.steelman !== "string" ||
    typeof parsed.redteam !== "string" ||
    typeof parsed.blind_spots !== "string"
  ) {
    console.error("[floor-ai-analysis] OpenAI response missed a required structured field");
    throw new Error("The analysis response was missing a required section.");
  }

  return {
    steelman: parsed.steelman.trim(),
    redteam: parsed.redteam.trim(),
    blindSpots: parsed.blind_spots.trim(),
    model: FLOOR_ANALYSIS_MODEL,
  };
}
