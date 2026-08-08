import { NextResponse, type NextRequest } from "next/server";
import { generateFloorThesisAnalysis } from "@/lib/floor-ai-analysis";
import {
  createFloorRequestSupabase,
  createFloorServiceSupabase,
  hasActiveFloorAccess,
} from "@/lib/floor-operations";

const PLACEHOLDER = "Generating...";
const STALE_CLAIM_MS = 2 * 60 * 1000;

type RouteContext = { params: Promise<{ thesisId: string }> };

type AnalysisClaim = {
  id: string;
  created_at: string;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function jsonError(message: string, status: number) {
  return json({ error: message }, status);
}

function isPlaceholderAnalysis(value: {
  steelman: string;
  redteam: string;
  blind_spots: string;
  model: string | null;
}) {
  return (
    value.model === null &&
    value.steelman === PLACEHOLDER &&
    value.redteam === PLACEHOLDER &&
    value.blind_spots === PLACEHOLDER
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { thesisId } = await context.params;
  const supabase = createFloorRequestSupabase(request);
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return jsonError("Sign in to request an analysis.", 401);
  }
  if (!(await hasActiveFloorAccess(supabase, auth.user.id))) {
    return jsonError("An active Floor membership is required.", 403);
  }

  const { data: thesis, error: thesisError } = await supabase
    .from("floor_theses")
    .select(
      "id, author_id, ticker, stance, conviction, horizon, entry_zone_low, entry_zone_high, exit_plan, thesis, catalysts, risks"
    )
    .eq("id", thesisId)
    .maybeSingle();

  if (thesisError || !thesis) {
    return jsonError("Thesis not found.", 404);
  }
  if (thesis.author_id !== auth.user.id) {
    return jsonError("Only the thesis author can request an analysis.", 403);
  }

  const service = createFloorServiceSupabase();

  // Claim the thesis before spending on a provider call. The unique index on
  // thesis_id keeps this atomic and prevents two concurrent generations from
  // both paying for model output.
  const { data: insertedClaim, error: claimError } = await service
    .from("floor_thesis_analyses")
    .insert({
      thesis_id: thesisId,
      steelman: PLACEHOLDER,
      redteam: PLACEHOLDER,
      blind_spots: PLACEHOLDER,
    })
    .select("id, created_at")
    .single();

  let claim: AnalysisClaim | null = insertedClaim;

  if (claimError) {
    if (claimError.code !== "23505") {
      return jsonError(claimError.message || "Unable to start the analysis.", 500);
    }

    // A previous interrupted request can leave the claim placeholder behind.
    // Recover only a stale placeholder. A fresh placeholder still represents
    // an in-flight request and must not trigger duplicate model spend.
    const { data: existing, error: existingError } = await service
      .from("floor_thesis_analyses")
      .select("id, steelman, redteam, blind_spots, model, created_at")
      .eq("thesis_id", thesisId)
      .maybeSingle();

    if (existingError) {
      return jsonError(existingError.message || "Unable to inspect the existing analysis.", 500);
    }
    if (!existing) {
      return jsonError("Unable to recover the existing analysis claim.", 500);
    }
    if (!isPlaceholderAnalysis(existing)) {
      return jsonError("This thesis already has an analysis.", 409);
    }

    const createdAt = new Date(existing.created_at).getTime();
    const isStale = Number.isFinite(createdAt) && Date.now() - createdAt >= STALE_CLAIM_MS;
    if (!isStale) {
      return jsonError("An analysis is already being generated. Try again shortly.", 409);
    }

    claim = { id: existing.id, created_at: existing.created_at };
  }

  if (!claim) {
    return jsonError("Unable to start the analysis.", 500);
  }

  let analysis;
  try {
    analysis = await generateFloorThesisAnalysis(thesis);
  } catch (error) {
    const cleanup = await service.from("floor_thesis_analyses").delete().eq("id", claim.id);
    if (cleanup.error) {
      console.error("[floor-ai-analysis] failed to remove incomplete claim", {
        code: cleanup.error.code,
      });
    }
    return jsonError(
      error instanceof Error ? error.message : "Unable to generate the analysis.",
      502
    );
  }

  const { data, error } = await service
    .from("floor_thesis_analyses")
    .update({
      steelman: analysis.steelman,
      redteam: analysis.redteam,
      blind_spots: analysis.blindSpots,
      model: analysis.model,
    })
    .eq("id", claim.id)
    .select("id, steelman, redteam, blind_spots, model, created_at")
    .single();

  if (error) {
    return jsonError(error.message || "Unable to save the analysis.", 500);
  }

  return json(data, 201);
}
