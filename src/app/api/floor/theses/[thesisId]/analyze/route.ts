import { NextResponse, type NextRequest } from "next/server";
import { generateFloorThesisAnalysis } from "@/lib/floor-ai-analysis";
import { createFloorRequestSupabase, createFloorServiceSupabase } from "@/lib/floor-operations";

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

  const { count, error: countError } = await supabase
    .from("floor_thesis_analyses")
    .select("id", { count: "exact", head: true })
    .eq("thesis_id", thesisId);

  if (countError) {
    return jsonError("Unable to check for an existing analysis.", 500);
  }
  if (count && count > 0) {
    return jsonError("This thesis already has an analysis.", 409);
  }

  let analysis;
  try {
    analysis = await generateFloorThesisAnalysis(thesis);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to generate the analysis.",
      502
    );
  }

  const service = createFloorServiceSupabase();
  const { data, error } = await service
    .from("floor_thesis_analyses")
    .insert({
      thesis_id: thesisId,
      steelman: analysis.steelman,
      redteam: analysis.redteam,
      blind_spots: analysis.blindSpots,
      model: analysis.model,
    })
    .select("id, steelman, redteam, blind_spots, model, created_at")
    .single();

  if (error) {
    return jsonError(error.message || "Unable to save the analysis.", 500);
  }

  return json(data, 201);
}
