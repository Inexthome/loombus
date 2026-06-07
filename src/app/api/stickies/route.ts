import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";

type StickyItem = {
  id: string;
  user_id: string;
  item_type: string;
  source_key: string;
  title: string;
  subtitle: string | null;
  href: string;
  position: number;
  created_at: string;
  updated_at: string;
};

function jsonError(message: string, status = 400, extras: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extras }, { status });
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return header.slice(7).trim();
}

function getSupabaseWithAuth(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCleanTopic(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const clean = value.trim();

  return (
    DISCUSSION_TOPICS.find(
      (topic) => topic.toLowerCase() === clean.toLowerCase()
    ) ?? ""
  );
}

function getCleanUsername(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
}

function getDiscussionIdFromInput(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const clean = value.trim();
  const uuidMatch = clean.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  );

  return uuidMatch?.[0] ?? "";
}

async function getUserAndAccess(request: NextRequest) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return { error: jsonError("Login required.", 401) };
  }

  const supabase = getSupabaseWithAuth(accessToken);

  if (!supabase) {
    return { error: jsonError("Stickies service is not configured.", 503) };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { error: jsonError("Login required.", 401) };
  }

  const [{ data: profileData }, { data: entitlementData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle(),
    supabase
      .from("user_ai_entitlements")
      .select("tier, ai_assisted_enabled")
      .eq("user_id", userData.user.id)
      .maybeSingle(),
  ]);

  const isAdmin = Boolean(profileData?.is_admin);
  const hasPremiumAccess =
    isAdmin ||
    (entitlementData?.ai_assisted_enabled === true &&
      ["premium", "admin"].includes(entitlementData.tier ?? ""));

  if (!hasPremiumAccess) {
    return {
      error: jsonError("Stickies requires Premium access.", 403, {
        upgradeRequired: true,
      }),
    };
  }

  return {
    supabase,
    user: userData.user,
  };
}

export async function GET(request: NextRequest) {
  const context = await getUserAndAccess(request);

  if ("error" in context) {
    return context.error;
  }

  const { data, error } = await context.supabase
    .from("sticky_items")
    .select("id, user_id, item_type, source_key, title, subtitle, href, position, created_at, updated_at")
    .eq("user_id", context.user.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({
    stickies: (data ?? []) as StickyItem[],
  });
}

export async function POST(request: NextRequest) {
  const context = await getUserAndAccess(request);

  if ("error" in context) {
    return context.error;
  }

  const body = await request.json().catch(() => ({}));
  const itemType = typeof body.itemType === "string" ? body.itemType.trim() : "discussion";

  if (itemType === "note") {
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 240) : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

    if (!title && !note) {
      return jsonError("Add a note title or note body.");
    }

    const { count } = await context.supabase
      .from("sticky_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.user.id);

    const sourceKey = `note:${crypto.randomUUID()}`;

    const { data: sticky, error: insertError } = await context.supabase
      .from("sticky_items")
      .insert({
        user_id: context.user.id,
        item_type: "note",
        source_key: sourceKey,
        title: title || "Untitled note",
        subtitle: note || null,
        href: "/stickies",
        position: count ?? 0,
        updated_at: new Date().toISOString(),
      })
      .select("id, user_id, item_type, source_key, title, subtitle, href, position, created_at, updated_at")
      .single();

    if (insertError) {
      return jsonError(insertError.message, 500);
    }

    return NextResponse.json({
      sticky,
    });
  }

  if (itemType === "topic") {
    const topic = getCleanTopic(body.topic ?? body.source);

    if (!topic) {
      return jsonError("Choose a valid topic.");
    }

    const { count } = await context.supabase
      .from("sticky_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.user.id);

    const { data: sticky, error: insertError } = await context.supabase
      .from("sticky_items")
      .upsert(
        {
          user_id: context.user.id,
          item_type: "topic",
          source_key: topic,
          title: topic,
          subtitle: "Pinned topic workspace card.",
          href: `/discussions?topic=${encodeURIComponent(topic)}`,
          position: count ?? 0,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,item_type,source_key",
        }
      )
      .select("id, user_id, item_type, source_key, title, subtitle, href, position, created_at, updated_at")
      .single();

    if (insertError) {
      return jsonError(insertError.message, 500);
    }

    return NextResponse.json({
      sticky,
    });
  }

  if (itemType === "person") {
    const username = getCleanUsername(body.username ?? body.source);

    if (!username) {
      return jsonError("Enter a valid username.");
    }

    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("id, username, full_name, bio")
      .eq("username", username)
      .maybeSingle();

    if (profileError) {
      return jsonError(profileError.message, 500);
    }

    if (!profile?.username) {
      return jsonError("Profile not found.", 404);
    }

    const { count } = await context.supabase
      .from("sticky_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.user.id);

    const displayName =
      profile.full_name?.trim() || `@${profile.username}`;

    const { data: sticky, error: insertError } = await context.supabase
      .from("sticky_items")
      .upsert(
        {
          user_id: context.user.id,
          item_type: "person",
          source_key: profile.id,
          title: displayName,
          subtitle: profile.bio || `@${profile.username}`,
          href: `/u/${profile.username}`,
          position: count ?? 0,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,item_type,source_key",
        }
      )
      .select("id, user_id, item_type, source_key, title, subtitle, href, position, created_at, updated_at")
      .single();

    if (insertError) {
      return jsonError(insertError.message, 500);
    }

    return NextResponse.json({
      sticky,
    });
  }

  const discussionId = getDiscussionIdFromInput(
    body.discussionId ?? body.discussionUrl ?? body.source
  );

  if (!discussionId) {
    return jsonError("Paste a valid discussion link or discussion ID.");
  }

  const { data: discussion, error: discussionError } = await context.supabase
    .from("discussions")
    .select("id, title, topic, body")
    .eq("id", discussionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (discussionError) {
    return jsonError(discussionError.message, 500);
  }

  if (!discussion) {
    return jsonError("Discussion not found.", 404);
  }

  const { count } = await context.supabase
    .from("sticky_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.user.id);

  const cleanBody = stripHtml(discussion.body ?? "");
  const subtitle = [
    discussion.topic,
    cleanBody ? cleanBody.slice(0, 180) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const itemPayload = {
    user_id: context.user.id,
    item_type: "discussion",
    source_key: discussion.id,
    title: discussion.title,
    subtitle,
    href: `/discussions/${discussion.id}`,
    position: count ?? 0,
    updated_at: new Date().toISOString(),
  };

  const { data: sticky, error: insertError } = await context.supabase
    .from("sticky_items")
    .upsert(itemPayload, {
      onConflict: "user_id,item_type,source_key",
    })
    .select("id, user_id, item_type, source_key, title, subtitle, href, position, created_at, updated_at")
    .single();

  if (insertError) {
    return jsonError(insertError.message, 500);
  }

  return NextResponse.json({
    sticky,
  });
}

export async function PATCH(request: NextRequest) {
  const context = await getUserAndAccess(request);

  if ("error" in context) {
    return context.error;
  }

  const body = await request.json().catch(() => ({}));
  const orderedIds: string[] = Array.isArray(body.orderedIds)
    ? body.orderedIds.filter(
        (id: unknown): id is string =>
          typeof id === "string" && id.trim().length > 0
      )
    : [];

  if (orderedIds.length === 0) {
    return jsonError("Missing sticky order.");
  }

  const { data: existingItems, error: existingError } = await context.supabase
    .from("sticky_items")
    .select("id")
    .eq("user_id", context.user.id);

  if (existingError) {
    return jsonError(existingError.message, 500);
  }

  const ownedIds = new Set((existingItems ?? []).map((item: { id: string }) => item.id));
  const hasUnknownId = orderedIds.some((id) => !ownedIds.has(id));

  if (hasUnknownId) {
    return jsonError("One or more stickies could not be reordered.", 403);
  }

  const updates = orderedIds.map((id, index) =>
    context.supabase
      .from("sticky_items")
      .update({
        position: index,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", context.user.id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    return jsonError(failed.error.message, 500);
  }

  return NextResponse.json({
    ok: true,
  });
}

export async function DELETE(request: NextRequest) {
  const context = await getUserAndAccess(request);

  if ("error" in context) {
    return context.error;
  }

  const body = await request.json().catch(() => ({}));
  const stickyId = typeof body.stickyId === "string" ? body.stickyId.trim() : "";

  if (!stickyId) {
    return jsonError("Missing sticky ID.");
  }

  const { error } = await context.supabase
    .from("sticky_items")
    .delete()
    .eq("id", stickyId)
    .eq("user_id", context.user.id);

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({
    ok: true,
  });
}
