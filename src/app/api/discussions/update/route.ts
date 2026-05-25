import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateContent } from "@/lib/moderation/content";
import { DISCUSSION_TOPICS, type DiscussionTopic } from "@/lib/discussion-topics";
import { normalizeDiscussionTags } from "@/lib/discussion-tags";
import { logAuditEvent } from "@/lib/audit-log";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";

const FREE_EDIT_WINDOW_MS = 15 * 60 * 1000;
const PREMIUM_EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const STANDARD_DISCUSSION_MAX_LENGTH = 5000;
const LONG_DISCUSSION_MAX_LENGTH = 12000;

type ExistingDiscussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  edit_count: number | null;
};

type ProfileAccess = {
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
};

function hasPremiumEditAccess(entitlement: AiEntitlement | null) {
  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium"
  );
}

function hasLongPostAccess(
  entitlement: AiEntitlement | null,
  isAdmin: boolean
) {
  if (isAdmin) {
    return true;
  }

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) > 50
  );
}

function getEditWindowLabel(isAdmin: boolean, hasPremiumAccess: boolean) {
  if (isAdmin) return "Admin";
  if (hasPremiumAccess) return "7 days";
  return "15 minutes";
}

function isWithinEditWindow(
  createdAt: string,
  isAdmin: boolean,
  hasPremiumAccess: boolean
) {
  if (isAdmin) {
    return true;
  }

  const createdTime = new Date(createdAt).getTime();
  const editWindow = hasPremiumAccess
    ? PREMIUM_EDIT_WINDOW_MS
    : FREE_EDIT_WINDOW_MS;

  return Date.now() - createdTime <= editWindow;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const authSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid session." },
        { status: 401 }
      );
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return NextResponse.json(
        { error: "Discussion update service is not configured." },
        { status: 503 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const body = await request.json();

    const discussionId = String(body.discussionId ?? "").trim();
    const title = String(body.title ?? "").trim();
    const requestedTopic = String(body.topic ?? "").trim();
    const content = String(body.body ?? "").trim();
    const hasTagPayload = Object.prototype.hasOwnProperty.call(body, "tags");
    const tagResult = normalizeDiscussionTags(hasTagPayload ? body.tags : []);

    if (tagResult.error) {
      return NextResponse.json(
        { error: tagResult.error },
        { status: 400 }
      );
    }

    const discussionTags = tagResult.tags;

    if (!discussionId) {
      return NextResponse.json(
        { error: "Missing discussion id." },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: "Please enter a discussion title." },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: "Please enter discussion content." },
        { status: 400 }
      );
    }

    const topic: DiscussionTopic = DISCUSSION_TOPICS.includes(
      requestedTopic as DiscussionTopic
    )
      ? requestedTopic as DiscussionTopic
      : "General";

    const [{ data: profile }, { data: entitlement }, { data: discussion }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("is_admin, account_status, enforcement_reason, suspended_until")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_ai_entitlements")
          .select("tier, ai_assisted_enabled, monthly_summary_limit")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("discussions")
          .select("id, user_id, title, topic, body, created_at, deleted_at, edit_count")
          .eq("id", discussionId)
          .maybeSingle(),
      ]);

    const profileAccess = (profile ?? null) as ProfileAccess | null;
    const enforcement = getAccountEnforcementResult(profileAccess);

    if (!enforcement.allowed) {
      return NextResponse.json(
        {
          error: enforcement.errorMessage,
          code: enforcement.code,
        },
        { status: 403 }
      );
    }

    const isAdmin = Boolean(profileAccess?.is_admin);
    const hasPremiumAccess = hasPremiumEditAccess(
      (entitlement ?? null) as AiEntitlement | null
    );
    const canUseLongPosts = hasLongPostAccess(
      (entitlement ?? null) as AiEntitlement | null,
      isAdmin
    );
    const maxDiscussionLength = canUseLongPosts
      ? LONG_DISCUSSION_MAX_LENGTH
      : STANDARD_DISCUSSION_MAX_LENGTH;

    const moderationError = validateContent(content, {
      maxLength: maxDiscussionLength,
    });

    if (moderationError) {
      return NextResponse.json(
        { error: moderationError },
        { status: 400 }
      );
    }

    const existingDiscussion = discussion as ExistingDiscussion | null;

    if (!existingDiscussion || existingDiscussion.deleted_at) {
      return NextResponse.json(
        { error: "Discussion not found." },
        { status: 404 }
      );
    }

    const isOwner = existingDiscussion.user_id === user.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to edit this discussion." },
        { status: 403 }
      );
    }

    if (!isWithinEditWindow(existingDiscussion.created_at, isAdmin, hasPremiumAccess)) {
      return NextResponse.json(
        {
          error: `This discussion is outside your edit window. Your current edit window is ${getEditWindowLabel(isAdmin, hasPremiumAccess)}.`,
          code: "edit_window_expired",
        },
        { status: 403 }
      );
    }

    const editedAt = new Date().toISOString();
    const previousValues = {
      title: existingDiscussion.title,
      topic: existingDiscussion.topic,
      body: existingDiscussion.body,
    };

    const { data: updatedDiscussion, error: updateError } = await supabase
      .from("discussions")
      .update({
        title,
        topic,
        body: content,
        updated_at: editedAt,
        edited_at: editedAt,
        edited_by: user.id,
        edit_count: (existingDiscussion.edit_count ?? 0) + 1,
      })
      .eq("id", discussionId)
      .select("id, user_id, title, topic, body, created_at, updated_at, edited_at, edited_by, edit_count")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if (hasTagPayload) {
      const { error: deleteTagsError } = await supabase
        .from("discussion_tags")
        .delete()
        .eq("discussion_id", discussionId);

      if (deleteTagsError) {
        return NextResponse.json(
          { error: deleteTagsError.message || "Unable to update discussion tags." },
          { status: 500 }
        );
      }

      if (discussionTags.length > 0) {
        const { error: insertTagsError } = await supabase
          .from("discussion_tags")
          .insert(
            discussionTags.map((tag) => ({
              discussion_id: discussionId,
              tag,
              created_by: user.id,
            }))
          );

        if (insertTagsError) {
          return NextResponse.json(
            { error: insertTagsError.message || "Unable to save discussion tags." },
            { status: 500 }
          );
        }
      }
    }

    await logAuditEvent({
      actor_id: user.id,
      action: "discussion.updated",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        previous: previousValues,
        next: {
          title,
          topic,
          body: content,
          tags: hasTagPayload ? discussionTags : undefined,
        },
        tags_updated: hasTagPayload,
        edit_window: getEditWindowLabel(isAdmin, hasPremiumAccess),
        edited_as_admin: isAdmin && !isOwner,
      },
    });

    return NextResponse.json({ discussion: updatedDiscussion });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
