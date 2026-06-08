import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";

const STICKIES_AI_MODEL =
  process.env.OPENAI_STICKIES_MODEL ||
  process.env.OPENAI_SUMMARY_MODEL ||
  "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

function clampText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function parseAiStickyCard(content: string) {
  const fallback = {
    title: "AI workspace card",
    summary: clampText(content, 320) || "Review this workspace prompt.",
    nextAction: "Decide what to do next.",
  };

  const match = content.match(/\{[\s\S]*\}/);

  if (!match) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(match[0]) as {
      title?: unknown;
      summary?: unknown;
      nextAction?: unknown;
    };

    return {
      title: clampText(parsed.title, 90) || fallback.title,
      summary: clampText(parsed.summary, 320) || fallback.summary,
      nextAction: clampText(parsed.nextAction, 160) || fallback.nextAction,
    };
  } catch {
    return fallback;
  }
}

async function generateAiStickyCard(prompt: string) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: STICKIES_AI_MODEL,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Create one concise Loombus Stickies workspace card. Return JSON only with keys: title, summary, nextAction. Keep it practical, specific, and non-hype.",
        },
        {
          role: "user",
          content: `User workspace prompt: ${prompt}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to generate AI sticky.");
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content ?? "";

  return parseAiStickyCard(content);
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
      .select("tier, ai_assisted_enabled, monthly_summary_limit")
      .eq("user_id", userData.user.id)
      .maybeSingle(),
  ]);

  const isAdmin = Boolean(profileData?.is_admin);
  const hasPremiumAccess =
    isAdmin ||
    (entitlementData?.ai_assisted_enabled === true &&
      ["premium", "premium_plus", "admin"].includes(entitlementData.tier ?? ""));

  const hasPremiumPlusAccess =
    isAdmin ||
    entitlementData?.tier === "admin" ||
    (entitlementData?.ai_assisted_enabled === true &&
      (entitlementData.tier === "premium_plus" ||
        (entitlementData.tier === "premium" &&
          (entitlementData.monthly_summary_limit ?? 0) > 50)));

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
    hasPremiumPlusAccess,
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

  if (itemType === "ai_summary") {
    if (!context.hasPremiumPlusAccess) {
      return jsonError("AI-generated Stickies require Premium Plus access.", 403, {
        code: "premium_plus_required",
        upgradeRequired: true,
      });
    }

    const prompt = clampText(body.prompt, 800);

    if (!prompt) {
      return jsonError("Enter a goal, question, or idea for the AI sticky.");
    }

    let generated;

    try {
      generated = await generateAiStickyCard(prompt);
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "Unable to generate AI sticky.",
        500
      );
    }

    const { count } = await context.supabase
      .from("sticky_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.user.id);

    const subtitle = [
      generated.summary,
      generated.nextAction ? `Next: ${generated.nextAction}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const { data: sticky, error: insertError } = await context.supabase
      .from("sticky_items")
      .insert({
        user_id: context.user.id,
        item_type: "ai_summary",
        source_key: `ai:${crypto.randomUUID()}`,
        title: generated.title,
        subtitle,
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

  if (itemType === "saved") {
    const bookmarkId = getDiscussionIdFromInput(body.bookmarkId ?? body.source);

    if (!bookmarkId) {
      return jsonError("Missing saved discussion ID.");
    }

    const { data: bookmark, error: bookmarkError } = await context.supabase
      .from("bookmarks")
      .select("id, discussion_id, private_note")
      .eq("id", bookmarkId)
      .eq("user_id", context.user.id)
      .maybeSingle();

    if (bookmarkError) {
      return jsonError(bookmarkError.message, 500);
    }

    if (!bookmark?.discussion_id) {
      return jsonError("Saved discussion not found.", 404);
    }

    const { data: discussion, error: discussionError } = await context.supabase
      .from("discussions")
      .select("id, title, topic, body")
      .eq("id", bookmark.discussion_id)
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
    const notePreview = stripHtml(bookmark.private_note ?? "");
    const subtitle = [
      "Saved discussion",
      discussion.topic,
      notePreview ? `Note: ${notePreview.slice(0, 140)}` : cleanBody.slice(0, 160),
    ]
      .filter(Boolean)
      .join(" · ");

    const { data: sticky, error: insertError } = await context.supabase
      .from("sticky_items")
      .upsert(
        {
          user_id: context.user.id,
          item_type: "saved",
          source_key: bookmark.id,
          title: discussion.title,
          subtitle,
          href: `/discussions/${discussion.id}`,
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

  if (body.action === "update_note") {
    const stickyId = typeof body.stickyId === "string" ? body.stickyId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 240) : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

    if (!stickyId) {
      return jsonError("Missing sticky ID.");
    }

    if (!title && !note) {
      return jsonError("Add a note title or note body.");
    }

    const { data: sticky, error } = await context.supabase
      .from("sticky_items")
      .update({
        title: title || "Untitled note",
        subtitle: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stickyId)
      .eq("user_id", context.user.id)
      .eq("item_type", "note")
      .select("id, user_id, item_type, source_key, title, subtitle, href, position, created_at, updated_at")
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({
      sticky,
    });
  }

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
