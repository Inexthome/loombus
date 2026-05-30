import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateContent } from "@/lib/moderation/content";
import { getAiSafetyErrorPayload, reviewContentSafety } from "@/lib/moderation/ai-safety";
import { DISCUSSION_TOPICS, type DiscussionTopic } from "@/lib/discussion-topics";
import { normalizeDiscussionTags } from "@/lib/discussion-tags";
import { logAuditEvent } from "@/lib/audit-log";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { createNotifications } from "@/lib/notifications";

const CREATE_COOLDOWN_MS = 30000;
const STANDARD_DISCUSSION_MAX_LENGTH = 5000;
const LONG_DISCUSSION_MAX_LENGTH = 12000;

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

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

async function getBlockedRelationshipUserIds(
  supabase: any,
  userId: string
) {
  const { data: blockRows } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  const blockedRelationshipUserIds = new Set<string>();

  for (const block of (blockRows ?? []) as BlockRow[]) {
    blockedRelationshipUserIds.add(
      block.blocker_id === userId ? block.blocked_id : block.blocker_id
    );
  }

  return blockedRelationshipUserIds;
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



async function createTopicAlertNotifications({
  supabase,
  discussionId,
  discussionTitle,
  discussionTopic,
  authorId,
}: {
  supabase: any;
  discussionId: string;
  discussionTitle: string;
  discussionTopic: string;
  authorId: string;
}) {
  const { data: topicAlerts, error: alertError } = await supabase
    .from("user_topic_alerts")
    .select("user_id")
    .eq("topic", discussionTopic)
    .eq("enabled", true)
    .neq("user_id", authorId);

  if (alertError) {
    console.error("Topic alert lookup failed:", alertError.message);
    return;
  }

  const candidateUserIds = [
    ...new Set(
      ((topicAlerts ?? []) as { user_id: string | null }[])
        .map((row) => row.user_id)
        .filter((userId): userId is string => Boolean(userId))
    ),
  ];

  if (candidateUserIds.length === 0) {
    return;
  }

  const { data: blockRows } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`and(blocker_id.eq.${authorId},blocked_id.in.(${candidateUserIds.join(",")})),and(blocked_id.eq.${authorId},blocker_id.in.(${candidateUserIds.join(",")}))`);

  const hiddenUserIds = new Set<string>();

  for (const block of (blockRows ?? []) as { blocker_id: string; blocked_id: string }[]) {
    if (block.blocker_id === authorId) {
      hiddenUserIds.add(block.blocked_id);
    }

    if (block.blocked_id === authorId) {
      hiddenUserIds.add(block.blocker_id);
    }
  }

  const notifications = candidateUserIds
    .filter((userId) => !hiddenUserIds.has(userId))
    .map((userId) => ({
      user_id: userId,
      actor_id: authorId,
      type: "topic_alert",
      target_type: "discussion",
      target_id: discussionId,
      message: `New discussion in ${discussionTopic}: ${discussionTitle}`,
    }));

  if (notifications.length === 0) {
    return;
  }

  const { error: topicNotificationError } = await createNotifications(notifications);

  if (topicNotificationError) {
    console.error("Topic alert notifications failed:", topicNotificationError.message);
  }
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

    const supabase = createClient(
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
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid session." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const title = String(body.title ?? "").trim();
    const requestedTopic = String(body.topic ?? "").trim();

    const topic: DiscussionTopic = DISCUSSION_TOPICS.includes(
      requestedTopic as DiscussionTopic
    )
      ? requestedTopic as DiscussionTopic
      : "General";

    const content = String(body.body ?? "").trim();
    const tagResult = normalizeDiscussionTags(body.tags);

    if (tagResult.error) {
      return NextResponse.json(
        { error: tagResult.error },
        { status: 400 }
      );
    }

    const discussionTags = tagResult.tags;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const tagSupabase =
      discussionTags.length > 0 && serviceKey
        ? createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceKey,
            {
              auth: {
                autoRefreshToken: false,
                persistSession: false,
              },
            }
          )
        : null;

    if (discussionTags.length > 0 && !tagSupabase) {
      return NextResponse.json(
        { error: "Discussion tag service is not configured." },
        { status: 503 }
      );
    }

    const [{ data: profile }, { data: entitlement }] = await Promise.all([
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
    const canUseLongPosts = hasLongPostAccess(
      (entitlement ?? null) as AiEntitlement | null,
      isAdmin
    );
    const maxDiscussionLength = canUseLongPosts
      ? LONG_DISCUSSION_MAX_LENGTH
      : STANDARD_DISCUSSION_MAX_LENGTH;

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

    const moderationError = validateContent(content, {
      maxLength: maxDiscussionLength,
    });

    if (moderationError) {
      return NextResponse.json(
        { error: moderationError },
        { status: 400 }
      );
    }

    const aiSafetyReview = await reviewContentSafety({
      content,
      contentType: "discussion",
    });

    if (aiSafetyReview.action !== "allow") {
      return NextResponse.json(
        getAiSafetyErrorPayload(aiSafetyReview),
        { status: 400 }
      );
    }

    const cooldownSince = new Date(
      Date.now() - CREATE_COOLDOWN_MS
    ).toISOString();

    const { data: recentPost } = await supabase
      .from("discussions")
      .select("id, created_at")
      .eq("user_id", user.id)
      .gte("created_at", cooldownSince)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentPost) {
      return NextResponse.json(
        { error: "Please wait before creating another discussion." },
        { status: 429 }
      );
    }

    const { data: discussion, error } = await supabase
      .from("discussions")
      .insert({
        user_id: user.id,
        title,
        topic,
        body: content,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (discussionTags.length > 0 && tagSupabase) {
      const { error: tagError } = await tagSupabase
        .from("discussion_tags")
        .insert(
          discussionTags.map((tag) => ({
            discussion_id: discussion.id,
            tag,
            created_by: user.id,
          }))
        );

      if (tagError) {
        return NextResponse.json(
          { error: "Discussion was created, but tags could not be saved." },
          { status: 500 }
        );
      }
    }

    await logAuditEvent({
      actor_id: user.id,
      action: "discussion.created",
      target_type: "discussion",
      target_id: discussion.id,
      metadata: {
        topic,
        title,
        tags: discussionTags,
      },
    });

    const blockedRelationshipUserIds = await getBlockedRelationshipUserIds(
      supabase,
      user.id
    );

    const { data: followerRows } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", user.id);

    const candidateFollowerIds = [
      ...new Set(
        (followerRows ?? [])
          .map((follow) => follow.follower_id)
          .filter((followerId): followerId is string => {
            if (!followerId || followerId === user.id) {
              return false;
            }

            return !blockedRelationshipUserIds.has(followerId);
          })
      ),
    ];

    if (candidateFollowerIds.length > 0) {
      const { data: followerPreferences } = await supabase
        .from("notification_preferences")
        .select("user_id, followed_discussions_enabled")
        .in("user_id", candidateFollowerIds);

      const preferenceMap = new Map(
        (followerPreferences ?? []).map((preference) => [
          preference.user_id,
          preference.followed_discussions_enabled,
        ])
      );

      const followerNotifications = candidateFollowerIds
        .filter((followerId) => preferenceMap.get(followerId) ?? true)
        .map((followerId) => ({
          user_id: followerId,
          actor_id: user.id,
          type: "followed_discussion",
          target_type: "discussion",
          target_id: discussion.id,
          message: `Someone you follow published a new discussion: ${title}`,
        }));

      if (followerNotifications.length > 0) {
        const { error: followerNotificationError } = await createNotifications(
          followerNotifications
        );

        if (followerNotificationError) {
          console.error(
            "Followed discussion notifications failed:",
            followerNotificationError.message
          );
        }
      }
    }

    return NextResponse.json({ discussion });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
