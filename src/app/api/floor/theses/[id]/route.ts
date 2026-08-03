import { NextResponse, type NextRequest } from "next/server";
import { createFloorRequestSupabase } from "@/lib/floor-operations";
import {
  FLOOR_CATALYSTS_MAX,
  FLOOR_EXIT_PLAN_MAX,
  FLOOR_RISKS_MAX,
  FLOOR_THESIS_MAX,
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

function asString(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = createFloorRequestSupabase(request);
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return jsonError("Sign in again.", 401);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return jsonError("Invalid request.", 400);
  }

  const { data: current, error: currentError } = await supabase
    .from("floor_theses")
    .select(
      "id, author_id, ticker, stance, conviction, horizon, entry_zone_low, entry_zone_high, exit_plan, thesis, catalysts, risks, lifecycle_status"
    )
    .eq("id", id)
    .single();

  if (currentError || !current) {
    return jsonError("Thesis not found.", 404);
  }
  if (current.author_id !== auth.user.id) {
    return jsonError("Only the author can manage this thesis.", 403);
  }

  const action = body.action;
  let changeType: "edit" | "withdraw" | "restore" | "delete" = "edit";
  let update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (action === "withdraw") {
    changeType = "withdraw";
    update = { ...update, lifecycle_status: "withdrawn", withdrawn_at: new Date().toISOString() };
  } else if (action === "restore") {
    changeType = "restore";
    update = {
      ...update,
      lifecycle_status: "active",
      withdrawn_at: null,
      deleted_at: null,
      deleted_by: null,
    };
  } else if (action === "delete") {
    changeType = "delete";
    update = {
      ...update,
      lifecycle_status: "deleted",
      deleted_at: new Date().toISOString(),
      deleted_by: auth.user.id,
    };
  } else {
    const thesis = asString(body.thesis, FLOOR_THESIS_MAX);
    const exitPlan = asString(body.exitPlan, FLOOR_EXIT_PLAN_MAX);
    const conviction = Number(body.conviction);

    if (!thesis || !exitPlan || !Number.isInteger(conviction) || conviction < 1 || conviction > 5) {
      return jsonError("Thesis, exit plan, and conviction are required.", 400);
    }
    update = {
      ...update,
      thesis,
      exit_plan: exitPlan,
      catalysts: asString(body.catalysts, FLOOR_CATALYSTS_MAX),
      risks: asString(body.risks, FLOOR_RISKS_MAX),
      conviction,
    };
  }

  const revision = await supabase.from("floor_thesis_revisions").insert({
    thesis_id: id,
    author_id: auth.user.id,
    snapshot: current,
    change_type: changeType,
  });
  if (revision.error) {
    return jsonError(revision.error.message, 400);
  }

  const result = await supabase
    .from("floor_theses")
    .update(update)
    .eq("id", id)
    .eq("author_id", auth.user.id);
  if (result.error) {
    return jsonError(result.error.message, 400);
  }

  return json({ ok: true });
}
