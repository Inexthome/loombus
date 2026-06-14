import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DISCUSSION_TOPICS, type DiscussionTopic } from "@/lib/discussion-topics";
import { normalizeRealityLens } from "@/lib/reality-lenses";
import { normalizePurposeLane } from "@/lib/purpose-lanes";
import { normalizeDiscussionTags } from "@/lib/discussion-tags";
import { logAuditEvent } from "@/lib/audit-log";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { reviewLoombusSafety } from "@/lib/moderation/safety-policy";
import { createNotifications } from "@/lib/notifications";
import { validatePublicProfileCompletion } from "@/lib/profile-completion";
import { normalizePublicText } from "@/lib/public-text";
import {
  checkAndRecordPasteUsage,
  normalizePastedCharacterCount,
} from "@/lib/copy-paste-limits";

const CREATE_COOLDOWN_MS = 30000;
const STANDARD_DISCUSSION_MAX_LENGTH = 5000;
const LONG_DISCUSSION_MAX_LENGTH = 12000;

type ProfileAccess = {
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
  full_name: string | null;
  username: string | null;
  bio: string | null;
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

async function getBlockedRelationshipUserIds(supabase: any, userId: string) {
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

function hasLongPostAccess(entitlement: AiEntitlement | null, isAdmin: boolean) {
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
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = await request.json();

    const title = normalizePublicText(body.title).trim();
    const requestedTopic = String(body.topic ?? "").trim();
    const reality_lens = normalizeRealityLens(body.realityLens ?? body.reality_lens);
    const purpose_lane = normalizePurposeLane(body.purposeLane ?? body.purpose_lane);
    const requestedDiscussionType = String(body.discussionType ?? body.discussion_type ?? "open_discussion").trim();
    const allowedDiscussionTypes = new Set([
      "open_discussion",
      "debate",
      "research_question",
      "problem_solving",
    ]);

    if (!allowedDiscussionTypes.has(requestedDiscussionType)) {
      return NextResponse.json(
        { error: "Choose a valid discussion type." },
        { status: 400 }
      );
    }

    const rawDiscussionMetadata =
      body.discussionMetadata && typeof body.discussionMetadata === "object" && !Array.isArray(body.discussionMetadata)
        ? body.discussionMetadata
        : {};

    const discussion_metadata = Object.fromEntries(
      Object.entries(rawDiscussionMetadata)
        .map(([key, value]) => [key, String(value ?? "").trim()])
        .filter(([, value]) => value.length > 0)
    );

    if (!DISCUSSION_TOPICS.includes(requestedTopic as DiscussionTopic)) {
      return NextResponse.json(
        { error: "Choose a discussion topic." },
        { status: 400 }
      );
    }

    const topic = requestedTopic as DiscussionTopic;

    const content = normalizePublicText(body.body).trim();
    const pastedCharacterCount = normalizePastedCharacterCount(body.pastedCharacterCount);
    const tagResult = normalizeDiscussionTags(body.tags);

    if (tagResult.error) {
      return NextResponse.json({ error: tagResult.error }, { status: 400 });
    }

    const discussionTags = tagResult.tags;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const tagSupabase =
      discussionTags.length > 0 && serviceKey
        ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          })
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
        .select("is_admin, account_status, enforcement_reason, suspended_until, full_name, username, bio")
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
        { error: enforcement.errorMessage, code: enforcement.code },
        { status: 403 }
      );
    }

    const isAdmin = Boolean(profileAccess?.is_admin);
    const profileGate = validatePublicProfileCompletion({
      fullName: profileAccess?.full_name ?? null,
      username: profileAccess?.username ?? null,
      bio: profileAccess?.bio ?? null,
    });

    if (!isAdmin && !profileGate.ok) {
      return NextResponse.json(
        { error: profileGate.message, code: profileGate.code },
        { status: 403 }
      );
    }

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

    const pasteLimitResult = await checkAndRecordPasteUsage({
      supabase,
      userId: user.id,
      entitlement: (entitlement ?? null) as AiEntitlement | null,
      isAdmin,
      featureKey: "discussion_body_paste",
      pastedCharacterCount,
    });

    if (!pasteLimitResult.allowed) {
      return NextResponse.json(
        {
          error: pasteLimitResult.error,
          code: pasteLimitResult.code,
          limit: pasteLimitResult.limit,
          used: pasteLimitResult.used,
          remaining: pasteLimitResult.remaining,
        },
        { status: 429 }
      );
    }

    const safetyDecision = await reviewLoombusSafety({
      userId: user.id,
      content,
      mode: "public_content",
      targetId: null,
      maxLength: maxDiscussionLength,
    });

    if (!safetyDecision.allowed) {
      return NextResponse.json(
        {
          error:
            safetyDecision.message ??
            "This content appears to violate Loombus safety rules. Please revise before posting.",
          code: safetyDecision.code ?? "content_safety_blocked",
          category: safetyDecision.category,
          provider: safetyDecision.provider,
        },
        { status: 400 }
      );
    }

    const cooldownSince = new Date(Date.now() - CREATE_COOLDOWN_MS).toISOString();

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
        reality_lens,
        purpose_lane,
        discussion_type: requestedDiscussionType,
        discussion_metadata,
        body: content,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
        reality_lens,
        purpose_lane,
        discussion_type: requestedDiscussionType,
        title,
        tags: discussionTags,
      },
    });

    const blockedRelationshipUserIds = await getBlockedRelationshipUserIds(supabase, user.id);

    const { data: followerRows } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", user.id);

    const candidateFollowerIds = [
      ...new Set(
        (followerRows ?? [])
          .map((follow) => follow.follower_id)
          .filter((followerId): followerId is string => {
            if (!followerId || followerId === user.id) return false;
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
        const { error: followerNotificationError } = await createNotifications(followerNotifications);

        if (followerNotificationError) {
          console.error(
            "Followed discussion notifications failed:",
            followerNotificationError.message
          );
        }
      }
    }

    await createTopicAlertNotifications({
      supabase,
      discussionId: discussion.id,
      discussionTitle: title,
      discussionTopic: topic,
      authorId: user.id,
    });

    return NextResponse.json({ discussion });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
