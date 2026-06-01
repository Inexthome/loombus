import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePurposeLane } from "@/lib/purpose-lanes";

const GOAL_STATUSES = new Set(["active", "paused", "completed"]);

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration.");
  }

  const authorization = request.headers.get("authorization") ?? "";

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null };
  }

  return { supabase, user };
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser(request);

    if (!user) {
      return jsonError("Unauthorized.", 401);
    }

    const { data, error } = await supabase
      .from("user_purpose_goals")
      .select("id, user_id, title, purpose_lane, private_note, status, created_at, updated_at, completed_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (error) {
      return jsonError(error.message || "Unable to load private goals.", 400);
    }

    return NextResponse.json({ goals: data ?? [] });
  } catch {
    return jsonError("Unexpected server error.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser(request);

    if (!user) {
      return jsonError("Unauthorized.", 401);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid goal payload.", 400);
    }

    const source = body as Record<string, unknown>;
    const title = cleanText(source.title, 120);
    const purposeLane = normalizePurposeLane(source.purposeLane ?? source.purpose_lane);
    const privateNote = cleanText(source.privateNote ?? source.private_note, 1000);

    if (!title) {
      return jsonError("Enter a goal title.", 400);
    }

    const { data, error } = await supabase
      .from("user_purpose_goals")
      .insert({
        user_id: user.id,
        title,
        purpose_lane: purposeLane,
        private_note: privateNote || null,
        status: "active",
      })
      .select("id, user_id, title, purpose_lane, private_note, status, created_at, updated_at, completed_at")
      .single();

    if (error) {
      return jsonError(error.message || "Unable to create private goal.", 400);
    }

    return NextResponse.json({ goal: data });
  } catch {
    return jsonError("Unexpected server error.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser(request);

    if (!user) {
      return jsonError("Unauthorized.", 401);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid goal payload.", 400);
    }

    const source = body as Record<string, unknown>;
    const goalId = source.goalId;

    if (!isValidUuid(goalId)) {
      return jsonError("Invalid goal id.", 400);
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (Object.prototype.hasOwnProperty.call(source, "title")) {
      const title = cleanText(source.title, 120);

      if (!title) {
        return jsonError("Enter a goal title.", 400);
      }

      updatePayload.title = title;
    }

    if (
      Object.prototype.hasOwnProperty.call(source, "purposeLane") ||
      Object.prototype.hasOwnProperty.call(source, "purpose_lane")
    ) {
      updatePayload.purpose_lane = normalizePurposeLane(
        source.purposeLane ?? source.purpose_lane
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(source, "privateNote") ||
      Object.prototype.hasOwnProperty.call(source, "private_note")
    ) {
      const privateNote = cleanText(source.privateNote ?? source.private_note, 1000);
      updatePayload.private_note = privateNote || null;
    }

    if (Object.prototype.hasOwnProperty.call(source, "status")) {
      const status = typeof source.status === "string" ? source.status : "";

      if (!GOAL_STATUSES.has(status)) {
        return jsonError("Invalid goal status.", 400);
      }

      updatePayload.status = status;
      updatePayload.completed_at = status === "completed" ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from("user_purpose_goals")
      .update(updatePayload)
      .eq("id", goalId)
      .eq("user_id", user.id)
      .select("id, user_id, title, purpose_lane, private_note, status, created_at, updated_at, completed_at")
      .single();

    if (error) {
      return jsonError(error.message || "Unable to update private goal.", 400);
    }

    return NextResponse.json({ goal: data });
  } catch {
    return jsonError("Unexpected server error.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser(request);

    if (!user) {
      return jsonError("Unauthorized.", 401);
    }

    const body = await request.json().catch(() => null);
    const goalId = body?.goalId;

    if (!isValidUuid(goalId)) {
      return jsonError("Invalid goal id.", 400);
    }

    const { error } = await supabase
      .from("user_purpose_goals")
      .delete()
      .eq("id", goalId)
      .eq("user_id", user.id);

    if (error) {
      return jsonError(error.message || "Unable to delete private goal.", 400);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return jsonError("Unexpected server error.", 500);
  }
}
