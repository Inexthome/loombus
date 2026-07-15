import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

const BLOCK_LIMIT = 500;

type BlockRow = {
  id: string;
  blocked_id: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
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

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Blocked-member service is not configured.", 500);
  }

  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  const { data: blockData, error: blockError } = await supabase
    .from("user_blocks")
    .select("id, blocked_id, created_at")
    .eq("blocker_id", accountAccess.user.id)
    .order("created_at", { ascending: false })
    .limit(BLOCK_LIMIT);

  if (blockError) {
    return jsonError(
      "Unable to load blocked members.",
      503,
      "blocked_members_unavailable"
    );
  }

  const blocks = (blockData ?? []) as BlockRow[];
  const blockedIds = [...new Set(blocks.map((block) => block.blocked_id))];
  let profiles = new Map<string, ProfileRow>();

  if (blockedIds.length > 0) {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, bio")
      .in("id", blockedIds);

    if (profileError) {
      return jsonError(
        "Unable to load blocked-member profiles.",
        503,
        "blocked_profiles_unavailable"
      );
    }

    profiles = new Map(
      ((profileData ?? []) as ProfileRow[]).map((profile) => [
        profile.id,
        profile,
      ])
    );
  }

  const items = blocks.map((block) => ({
    blockId: block.id,
    blockedAt: block.created_at,
    profile: profiles.get(block.blocked_id) ?? {
      id: block.blocked_id,
      full_name: null,
      username: null,
      avatar_url: null,
      bio: null,
    },
    profileAvailable: profiles.has(block.blocked_id),
  }));

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      count: items.length,
      limit: BLOCK_LIMIT,
      items,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
