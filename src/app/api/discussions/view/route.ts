import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VIEW_DEDUPE_HOURS = 24;

function jsonError(message: string, status: number, extras: Record<string, unknown> = {}) {
  return NextResponse.json(
    { error: message, ...extras },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getRequestSupabase(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") ?? "";

  if (!supabaseUrl || !anonKey || !authorization) {
    return null;
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });
}

async function getViewerId(request: NextRequest) {
  const requestSupabase = getRequestSupabase(request);

  if (!requestSupabase) {
    return null;
  }

  const {
    data: { user },
  } = await requestSupabase.auth.getUser();

  return user?.id ?? null;
}

async function verifyDiscussionAudienceAccess(
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
  discussionId: string,
  viewerId: string | null
) {
  const { data, error } = await supabase.rpc("can_view_discussion_audience", {
    p_discussion_id: discussionId,
    p_viewer_user_id: viewerId,
  });

  if (error) {
    const missing =
      error.code === "42883" ||
      /can_view_discussion_audience|schema cache|could not find the function/i.test(
        error.message ?? ""
      );

    return missing
      ? { allowed: true, unavailable: false }
      : { allowed: false, unavailable: true };
  }

  return { allowed: data === true, unavailable: false };
}

async function getDiscussionMetrics(
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
  discussionId: string
) {
  const [
    { count: replyCount },
    { count: saveCount },
    { count: viewCount },
    { count: stickyCount },
  ] = await Promise.all([
    supabase
      .from("replies")
      .select("id", { count: "exact", head: true })
      .eq("discussion_id", discussionId)
      .is("deleted_at", null),
    supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("discussion_id", discussionId),
    supabase
      .from("discussion_views")
      .select("discussion_id", { count: "exact", head: true })
      .eq("discussion_id", discussionId),
    supabase
      .from("sticky_items")
      .select("id", { count: "exact", head: true })
      .eq("item_type", "discussion")
      .eq("source_key", discussionId),
  ]);

  const replies = replyCount ?? 0;
  const saves = saveCount ?? 0;
  const views = viewCount ?? 0;
  const stickies = stickyCount ?? 0;

  return {
    replyCount: replies,
    saveCount: saves,
    viewCount: views,
    stickyCount: stickies,
    signalScore: replies * 3 + saves * 5 + views,
  };
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabase();

  if (!supabase) {
    return jsonError("Discussion view service is not configured.", 503);
  }

  const body = await request.json().catch(() => ({}));
  const discussionId = String(body?.discussionId ?? "").trim();

  if (!isValidUuid(discussionId)) {
    return jsonError("Invalid discussion id.", 400);
  }

  const { data: discussion, error: discussionError } = await supabase
    .from("discussions")
    .select("id")
    .eq("id", discussionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (discussionError) {
    return jsonError(discussionError.message, 500);
  }

  if (!discussion) {
    return jsonError("Discussion not found.", 404);
  }

  const viewerId = await getViewerId(request);
  const audienceAccess = await verifyDiscussionAudienceAccess(
    supabase,
    discussionId,
    viewerId
  );

  if (audienceAccess.unavailable) {
    return jsonError("Unable to verify Discussion access.", 503);
  }

  if (!audienceAccess.allowed) {
    return jsonError("Discussion not found.", 404);
  }

  const dedupeSince = new Date(
    Date.now() - VIEW_DEDUPE_HOURS * 60 * 60 * 1000
  ).toISOString();

  let shouldTrackView = Boolean(viewerId);

  if (viewerId) {
    const { data: recentView, error: recentViewError } = await supabase
      .from("discussion_views")
      .select("discussion_id")
      .eq("discussion_id", discussionId)
      .eq("viewer_id", viewerId)
      .gte("viewed_at", dedupeSince)
      .limit(1)
      .maybeSingle();

    if (recentViewError) {
      return jsonError(recentViewError.message, 500);
    }

    shouldTrackView = !recentView;
  }

  if (shouldTrackView && viewerId) {
    const { error: insertError } = await supabase.from("discussion_views").insert({
      discussion_id: discussionId,
      viewer_id: viewerId,
    });

    if (insertError) {
      return jsonError(insertError.message || "Unable to track discussion view.", 500);
    }
  }

  const metrics = await getDiscussionMetrics(supabase, discussionId);

  return NextResponse.json(
    {
      tracked: shouldTrackView,
      discussionId,
      ...metrics,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(request: NextRequest) {
  const supabase = getServiceSupabase();

  if (!supabase) {
    return jsonError("Discussion view service is not configured.", 503);
  }

  const discussionId = String(request.nextUrl.searchParams.get("discussionId") ?? "").trim();

  if (!isValidUuid(discussionId)) {
    return jsonError("Invalid discussion id.", 400);
  }

  const viewerId = await getViewerId(request);
  const audienceAccess = await verifyDiscussionAudienceAccess(
    supabase,
    discussionId,
    viewerId
  );

  if (audienceAccess.unavailable) {
    return jsonError("Unable to verify Discussion access.", 503);
  }

  if (!audienceAccess.allowed) {
    return jsonError("Discussion not found.", 404);
  }

  const metrics = await getDiscussionMetrics(supabase, discussionId);

  return NextResponse.json(
    {
      discussionId,
      ...metrics,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
