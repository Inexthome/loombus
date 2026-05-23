import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_REPORT_REASON, REPORT_REASONS } from "@/lib/report-reasons";

type ReportTargetType = "discussion" | "reply" | "profile";

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

function getCleanReason(value: unknown) {
  if (typeof value !== "string") {
    return DEFAULT_REPORT_REASON;
  }

  const clean = value.trim();

  if (!REPORT_REASONS.includes(clean as (typeof REPORT_REASONS)[number])) {
    return DEFAULT_REPORT_REASON;
  }

  return clean;
}

export async function POST(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid report payload.", 400);
  }

  const targetType = (body as Record<string, unknown>).targetType as ReportTargetType;
  const reason = getCleanReason((body as Record<string, unknown>).reason);

  if (
    targetType !== "discussion" &&
    targetType !== "reply" &&
    targetType !== "profile"
  ) {
    return jsonError("Invalid report target.", 400);
  }

  if (targetType === "discussion") {
    const discussionId = (body as Record<string, unknown>).discussionId;

    if (!isValidUuid(discussionId)) {
      return jsonError("Invalid discussion id.", 400);
    }

    const { data: existingReport } = await supabase
      .from("reports")
      .select("id")
      .eq("reporter_id", user.id)
      .eq("discussion_id", discussionId)
      .is("reply_id", null)
      .maybeSingle();

    if (existingReport) {
      return jsonError("You already reported this discussion.", 409);
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      discussion_id: discussionId,
      reason,
    });

    if (error) {
      if (error.code === "23505") {
        return jsonError("You already reported this discussion.", 409);
      }

      return jsonError(error.message || "Unable to submit report.", 400);
    }

    return NextResponse.json({ ok: true });
  }

  if (targetType === "reply") {
    const discussionId = (body as Record<string, unknown>).discussionId;
    const replyId = (body as Record<string, unknown>).replyId;

    if (!isValidUuid(discussionId)) {
      return jsonError("Invalid discussion id.", 400);
    }

    if (!isValidUuid(replyId)) {
      return jsonError("Invalid reply id.", 400);
    }

    const { data: existingReport } = await supabase
      .from("reports")
      .select("id")
      .eq("reporter_id", user.id)
      .eq("reply_id", replyId)
      .maybeSingle();

    if (existingReport) {
      return jsonError("You already reported this reply.", 409);
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      discussion_id: discussionId,
      reply_id: replyId,
      reason,
    });

    if (error) {
      if (error.code === "23505") {
        return jsonError("You already reported this reply.", 409);
      }

      return jsonError(error.message || "Unable to report reply.", 400);
    }

    return NextResponse.json({ ok: true });
  }

  const profileId = (body as Record<string, unknown>).profileId;

  if (!isValidUuid(profileId)) {
    return jsonError("Invalid profile id.", 400);
  }

  if (profileId === user.id) {
    return jsonError("You cannot report your own profile.", 400);
  }

  const { data: existingReport } = await supabase
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("reported_profile_id", profileId)
    .maybeSingle();

  if (existingReport) {
    return jsonError("You already reported this profile.", 409);
  }

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_profile_id: profileId,
    reason,
  });

  if (error) {
    if (error.code === "23505") {
      return jsonError("You already reported this profile.", 409);
    }

    return jsonError(error.message || "Unable to report profile.", 400);
  }

  return NextResponse.json({ ok: true });
}
