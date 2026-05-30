import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateContent } from "@/lib/moderation/content";
import { getAiSafetyErrorPayload, reviewContentSafety } from "@/lib/moderation/ai-safety";
import { logAuditEvent } from "@/lib/audit-log";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { createNotification, createNotifications } from "@/lib/notifications";

const REPLY_COOLDOWN_MS = 10000;
const MENTION_PATTERN = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{2,30})/g;

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

type ProfileAccess = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

type ReferencedReply = {
  id: string;
  user_id: string;
  discussion_id: string;
  body: string;
  deleted_at: string | null;
};

function getQuotedExcerpt(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");

  if (normalized.length <= 280) {
    return normalized;
  }

  return `${normalized.slice(0, 277).trim()}...`;
}

function extractMentionUsernames(content: string) {
  const matches = [...content.matchAll(MENTION_PATTERN)];

  return [
    ...new Set(
      matches
        .map((match) => match[2]?.toLowerCase().trim())
        .filter((username): username is string => Boolean(username))
    ),
  ].slice(0, 10);
}

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status, enforcement_reason, suspended_until")
      .eq("id", user.id)
      .maybeSingle();

    const enforcement = getAccountEnforcementResult(
      (profile ?? null) as ProfileAccess | null
    );

    if (!enforcement.allowed) {
      return NextResponse.json(
        {
          error: enforcement.errorMessage,
          code: enforcement.code,
        },
        { status: 403 }
      );
    }

    const blockedRelationshipUserIds = await getBlockedRelationshipUserIds(
      supabase,
      user.id
    );

    const body = await request.json();

    const discussionId = String(body.discussionId ?? "").trim();
    const content = String(body.body ?? "").trim();
    const referencedReplyId = String(
      body.referencedReplyId ?? body.referenced_reply_id ?? ""
    ).trim();

    if (!discussionId) {
      return NextResponse.json(
        { error: "Missing discussion." },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: "Please enter a reply." },
        { status: 400 }
      );
    }

    const moderationError = validateContent(content);

    if (moderationError) {
      return NextResponse.json(
        { error: moderationError },
        { status: 400 }
      );
    }

    const aiSafetyReview = await reviewContentSafety({
      content,
      contentType: "reply",
    });

    if (aiSafetyReview.action !== "allow") {
      return NextResponse.json(
        getAiSafetyErrorPayload(aiSafetyReview),
        { status: 400 }
      );
    }

    let referencedReply: ReferencedReply | null = null;

    if (referencedReplyId) {
      const { data: referencedReplyData, error: referencedReplyError } = await supabase
        .from("replies")
        .select("id, user_id, discussion_id, body, deleted_at")
        .eq("id", referencedReplyId)
        .maybeSingle();

      referencedReply = (referencedReplyData ?? null) as ReferencedReply | null;

      if (referencedReplyError || !referencedReply || referencedReply.deleted_at) {
        return NextResponse.json(
          { error: "Referenced reply not found." },
          { status: 404 }
        );
      }

      if (referencedReply.discussion_id !== discussionId) {
        return NextResponse.json(
          { error: "Referenced reply does not belong to this discussion." },
          { status: 400 }
        );
      }

      if (referencedReply.user_id === user.id) {
        return NextResponse.json(
          { error: "Respond to another member's point instead of referencing your own reply." },
          { status: 400 }
        );
      }

      if (blockedRelationshipUserIds.has(referencedReply.user_id)) {
        return NextResponse.json(
          { error: "You cannot respond to a point from a member you have blocked or who has blocked you." },
          { status: 403 }
        );
      }
    }

    const cooldownSince = new Date(
      Date.now() - REPLY_COOLDOWN_MS
    ).toISOString();

    const { data: recentReply } = await supabase
      .from("replies")
      .select("id, created_at")
      .eq("user_id", user.id)
      .gte("created_at", cooldownSince)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentReply) {
      return NextResponse.json(
        { error: "Please wait before replying again." },
        { status: 429 }
      );
    }

    const { data: reply, error } = await supabase
      .from("replies")
      .insert({
        discussion_id: discussionId,
        user_id: user.id,
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

    await logAuditEvent({
      actor_id: user.id,
      action: "reply.created",
      target_type: "reply",
      target_id: reply.id,
      metadata: {
        discussion_id: discussionId,
        referenced_reply_id: referencedReply?.id ?? null,
      },
    });

    const { data: discussion } = await supabase
      .from("discussions")
      .select("user_id, title")
      .eq("id", discussionId)
      .single();

    const alreadyNotifiedUserIds = new Set<string>();

    if (
      discussion &&
      discussion.user_id !== user.id &&
      !blockedRelationshipUserIds.has(discussion.user_id)
    ) {
      const { data: preferences } = await supabase
        .from("notification_preferences")
        .select("replies_enabled")
        .eq("user_id", discussion.user_id)
        .maybeSingle();

      const repliesEnabled = preferences?.replies_enabled ?? true;

      if (repliesEnabled) {
        const { error: notificationError } = await createNotification({
          user_id: discussion.user_id,
          actor_id: user.id,
          type: "reply",
          target_type: "discussion",
          target_id: discussionId,
          message: `Someone replied to your discussion: ${discussion.title}`,
        });

        if (notificationError) {
          console.error("Reply notification failed:", notificationError.message);
        } else {
          alreadyNotifiedUserIds.add(discussion.user_id);
        }
      }
    }

    const mentionedUsernames = extractMentionUsernames(content);

    if (mentionedUsernames.length > 0 && discussion) {
      const { data: mentionedProfiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("username", mentionedUsernames);

      const candidateMentionUserIds = [
        ...new Set(
          (mentionedProfiles ?? [])
            .map((profile) => profile.id)
            .filter((profileId) => {
              if (!profileId) {
                return false;
              }

              if (profileId === user.id) {
                return false;
              }

              if (profileId === discussion.user_id) {
                return false;
              }

              if (blockedRelationshipUserIds.has(profileId)) {
                return false;
              }

              return true;
            })
        ),
      ];

      if (candidateMentionUserIds.length > 0) {
        const { data: mentionPreferences } = await supabase
          .from("notification_preferences")
          .select("user_id, mentions_enabled")
          .in("user_id", candidateMentionUserIds);

        const preferenceMap = new Map(
          (mentionPreferences ?? []).map((preference) => [
            preference.user_id,
            preference.mentions_enabled,
          ])
        );

        const mentionNotifications = candidateMentionUserIds
          .filter((mentionedUserId) => preferenceMap.get(mentionedUserId) ?? true)
          .map((mentionedUserId) => {
            alreadyNotifiedUserIds.add(mentionedUserId);

            return {
              user_id: mentionedUserId,
              actor_id: user.id,
              type: "mention",
              target_type: "discussion",
              target_id: discussionId,
              message: `Someone mentioned you in a discussion: ${discussion.title}`,
            };
          });

        if (mentionNotifications.length > 0) {
          const { error: mentionError } = await createNotifications(mentionNotifications);

          if (mentionError) {
            console.error("Mention notification failed:", mentionError.message);
          }
        }
      }
    }

    if (discussion) {
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

              if (alreadyNotifiedUserIds.has(followerId)) {
                return false;
              }

              if (blockedRelationshipUserIds.has(followerId)) {
                return false;
              }

              return true;
            })
        ),
      ];

      if (candidateFollowerIds.length > 0) {
        const { data: followerPreferences } = await supabase
          .from("notification_preferences")
          .select("user_id, followed_replies_enabled")
          .in("user_id", candidateFollowerIds);

        const preferenceMap = new Map(
          (followerPreferences ?? []).map((preference) => [
            preference.user_id,
            preference.followed_replies_enabled,
          ])
        );

        const followerReplyNotifications = candidateFollowerIds
          .filter((followerId) => preferenceMap.get(followerId) ?? false)
          .map((followerId) => ({
            user_id: followerId,
            actor_id: user.id,
            type: "followed_reply",
            target_type: "discussion",
            target_id: discussionId,
            message: `Someone you follow replied to a discussion: ${discussion.title}`,
          }));

        if (followerReplyNotifications.length > 0) {
          const { error: followerReplyError } = await createNotifications(
            followerReplyNotifications
          );

          if (followerReplyError) {
            console.error(
              "Followed reply notifications failed:",
              followerReplyError.message
            );
          }
        }
      }
    }

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
