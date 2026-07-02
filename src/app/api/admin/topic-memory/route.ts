import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AdminProfileRow = {
  is_admin: boolean | null;
};

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

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function requireAdmin(supabase: ReturnType<typeof getSupabaseForRequest>) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, error: jsonError("Unauthorized.", 401) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<AdminProfileRow>();

  if (profileError || !profile?.is_admin) {
    return { user: null, error: jsonError("Admin access required.", 403) };
  }

  return { user, error: null };
}

export async function GET(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { error: adminError } = await requireAdmin(supabase);

  if (adminError) {
    return adminError;
  }

  let admin;

  try {
    admin = getServiceRoleClient();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const [discussionResult, tagResult, aiOutputResult, replyResult, viewResult, bookmarkResult] =
    await Promise.all([
      admin
        .from("discussions")
        .select("id, title, topic, reality_lens, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500),
      admin.from("discussion_tags").select("discussion_id, tag").limit(2000),
      admin
        .from("discussion_ai_outputs")
        .select("discussion_id, feature_key, generated_at")
        .in("feature_key", ["conversation_map", "related_ideas"])
        .limit(2000),
      admin
        .from("replies")
        .select("discussion_id, created_at")
        .is("deleted_at", null)
        .limit(5000),
      admin.from("discussion_views").select("discussion_id").limit(5000),
      admin.from("bookmarks").select("discussion_id").limit(5000),
    ]);

  if (discussionResult.error) {
    return jsonError(discussionResult.error.message || "Unable to load discussions.", 400);
  }

  if (tagResult.error) {
    return jsonError(tagResult.error.message || "Unable to load discussion tags.", 400);
  }

  if (aiOutputResult.error) {
    return jsonError(aiOutputResult.error.message || "Unable to load AI outputs.", 400);
  }

  if (replyResult.error) {
    return jsonError(replyResult.error.message || "Unable to load replies.", 400);
  }

  if (viewResult.error) {
    return jsonError(viewResult.error.message || "Unable to load discussion views.", 400);
  }

  if (bookmarkResult.error) {
    return jsonError(bookmarkResult.error.message || "Unable to load bookmarks.", 400);
  }

  return NextResponse.json({
    discussions: discussionResult.data ?? [],
    tags: tagResult.data ?? [],
    aiOutputs: aiOutputResult.data ?? [],
    replies: replyResult.data ?? [],
    views: viewResult.data ?? [],
    bookmarks: bookmarkResult.data ?? [],
  });
}
