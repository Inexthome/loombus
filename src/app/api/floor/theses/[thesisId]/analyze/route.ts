import { NextResponse, type NextRequest } from "next/server";
import { generateFloorThesisAnalysis } from "@/lib/floor-ai-analysis";
import {
  createFloorRequestSupabase,
  createFloorServiceSupabase,
  hasActiveFloorAccess,
} from "@/lib/floor-operations";

const PLACEHOLDER = "Generating...";

type RouteContext = { params: Promise<{ thesisId: string }> };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function jsonError(message: string, status: number) {
  return json({ error: message }, status);
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

  // Claim the (thesis_id) slot before spending on a model call. The unique
  // index on floor_thesis_analyses(thesis_id) makes this atomic -- a
  // concurrent request loses here with 23505, before it ever calls the
  // model, instead of racing past a count() check and paying for a
  // duplicate generation.
  const { data: claim, error: claimError } = await service
    .from("floor_thesis_analyses")
    .insert({
      thesis_id: thesisId,
      steelman: PLACEHOLDER,
      redteam: PLACEHOLDER,
      blind_spots: PLACEHOLDER,
    })
    .select("id")
    .single();

  if (claimError) {
    if (claimError.code === "23505") {
      return jsonError("This thesis already has an analysis.", 409);
    }
    return jsonError(claimError.message || "Unable to start the analysis.", 500);
  }

  let analysis;
  try {
    analysis = await generateFloorThesisAnalysis(thesis);
  } catch (error) {
    await service.from("floor_thesis_analyses").delete().eq("id", claim.id);
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
