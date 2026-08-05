import { NextResponse, type NextRequest } from "next/server";
import { createFloorRequestSupabase, hasActiveFloorAccess } from "@/lib/floor-operations";
import {
  FLOOR_CATALYSTS_MAX,
  FLOOR_EXIT_PLAN_MAX,
  FLOOR_RISKS_MAX,
  FLOOR_THESIS_MAX,
  FLOOR_TICKER_MAX,
  isFloorHorizon,
  isFloorStance,
} from "@/lib/floor-shared";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function jsonError(message: string, status: number) {
  return json({ error: message }, status);
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: NextRequest) {
  const supabase = createFloorRequestSupabase(request);
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return jsonError("Sign in to post on The Floor.", 401);
  }
  if (!(await hasActiveFloorAccess(supabase, auth.user.id))) {
    return jsonError("An active Floor membership is required.", 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body.", 400);
  }
  const payload = body as Record<string, unknown>;

  const ticker = asString(payload.ticker).toUpperCase().slice(0, FLOOR_TICKER_MAX);
  const stance = payload.stance;
  const horizon = payload.horizon;
  const convictionRaw = payload.conviction;
  const conviction =
    typeof convictionRaw === "number" ? Math.round(convictionRaw) : Number(convictionRaw);
  const entryZoneLow = asOptionalNumber(payload.entryZoneLow);
  const entryZoneHigh = asOptionalNumber(payload.entryZoneHigh);
  const exitPlan = asString(payload.exitPlan).slice(0, FLOOR_EXIT_PLAN_MAX);
  const thesis = asString(payload.thesis).slice(0, FLOOR_THESIS_MAX);
  const catalysts = asString(payload.catalysts).slice(0, FLOOR_CATALYSTS_MAX);
  const risks = asString(payload.risks).slice(0, FLOOR_RISKS_MAX);

  if (!ticker) return jsonError("A ticker is required.", 400);
  if (!isFloorStance(stance)) return jsonError("Choose a valid stance.", 400);
  if (!isFloorHorizon(horizon)) return jsonError("Choose a valid horizon.", 400);
  if (!Number.isInteger(conviction) || conviction < 1 || conviction > 5) {
    return jsonError("Conviction must be between 1 and 5.", 400);
  }
  if (entryZoneLow !== null && entryZoneHigh !== null && entryZoneHigh < entryZoneLow) {
    return jsonError("Entry zone high must be at or above the entry zone low.", 400);
  }
  if (!exitPlan) return jsonError("An exit plan is required.", 400);
  if (!thesis) return jsonError("A thesis is required.", 400);

  const { data, error } = await supabase
    .from("floor_theses")
    .insert({
      author_id: auth.user.id,
      ticker,
      stance,
      conviction,
      horizon,
      entry_zone_low: entryZoneLow,
      entry_zone_high: entryZoneHigh,
      exit_plan: exitPlan,
      thesis,
      catalysts,
      risks,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "42501") {
      return jsonError(
        "You need to be a verified adult member in good standing to post on The Floor.",
        403
      );
    }
    return jsonError(error.message || "Unable to post your thesis.", 400);
  }

  return json({ id: data.id }, 201);
}
