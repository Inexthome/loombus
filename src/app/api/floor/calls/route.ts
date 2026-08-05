import { NextResponse, type NextRequest } from "next/server";
import { createFloorRequestSupabase, hasActiveFloorAccess } from "@/lib/floor-operations";
import {
  FLOOR_PREDICTION_MAX,
  FLOOR_TICKER_MAX,
  formatFloorCallPrediction,
  isFloorComparator,
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

function asNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export async function POST(request: NextRequest) {
  const supabase = createFloorRequestSupabase(request);
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return jsonError("Sign in to post a falsifiable call.", 401);
  }
  if (!(await hasActiveFloorAccess(supabase, auth.user.id))) {
    return jsonError("An active Floor membership is required.", 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body.", 400);
  }
  const payload = body as Record<string, unknown>;

  const thesisId = payload.thesisId;
  if (!validUuid(thesisId)) return jsonError("A valid thesis is required.", 400);

  const ticker = asString(payload.ticker).toUpperCase().slice(0, FLOOR_TICKER_MAX);
  const comparator = payload.comparator;
  const targetValue = asNumber(payload.targetValue);
  const targetValueHigh = asNumber(payload.targetValueHigh);
  const resolvesByRaw = asString(payload.resolvesBy);
  const resolvesByDate = resolvesByRaw ? new Date(resolvesByRaw) : null;

  if (!ticker) return jsonError("A ticker is required.", 400);
  if (!isFloorComparator(comparator)) return jsonError("Choose a valid comparator.", 400);
  if (targetValue === null) return jsonError("A target value is required.", 400);
  if (comparator === "range" && (targetValueHigh === null || targetValueHigh <= targetValue)) {
    return jsonError("A range call needs a high target above the low target.", 400);
  }
  if (comparator !== "range" && targetValueHigh !== null) {
    return jsonError("Only a range call uses a high target.", 400);
  }
  if (!resolvesByDate || Number.isNaN(resolvesByDate.getTime())) {
    return jsonError("A valid resolution date is required.", 400);
  }
  if (resolvesByDate.getTime() <= Date.now()) {
    return jsonError("The resolution date must be in the future.", 400);
  }

  // The prediction sentence is always derived server-side from the structured
  // claim below -- never taken from the client -- so the human-readable text
  // and the fields the resolver scores can never disagree.
  const resolvesByIso = resolvesByDate.toISOString();
  const prediction = formatFloorCallPrediction(
    ticker,
    comparator,
    targetValue,
    targetValueHigh,
    resolvesByIso
  ).slice(0, FLOOR_PREDICTION_MAX);

  if (!prediction) {
    return jsonError("Unable to build a falsifiable prediction from these fields.", 400);
  }

  const { data, error } = await supabase
    .from("floor_calls")
    .insert({
      thesis_id: thesisId,
      author_id: auth.user.id,
      ticker,
      prediction,
      comparator,
      target_value: targetValue,
      target_value_high: comparator === "range" ? targetValueHigh : null,
      resolves_by: resolvesByIso,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "42501") {
      return jsonError(
        "You can only attach a falsifiable call to your own thesis, and you need to be a verified adult member in good standing.",
        403
      );
    }
    return jsonError(error.message || "Unable to post your call.", 400);
  }

  return json({ id: data.id }, 201);
}
