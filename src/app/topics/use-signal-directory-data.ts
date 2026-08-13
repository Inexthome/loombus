"use client";

import { supabase } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import type {
  BlockRow,
  Discussion,
  Profile,
} from "./signal-directory-model";

export function useSignalDirectoryData() {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [saveCounts, setSaveCounts] = useState<Record<string, number>>({});
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [canFollowTopics, setCanFollowTopics] = useState(false);
  const [followedTopics, setFollowedTopics] = useState<string[]>([]);
  const [savingTopic, setSavingTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDirectory() {
      setLoading(true);
      setMessage("");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id ?? null;
        const accessToken = sessionData.session?.access_token ?? "";
        const hiddenUserIds = new Set<string>();

        if (mounted) {
          setViewerId(userId);
          setCanFollowTopics(Boolean(userId));
        }

        if (userId) {
          const { data: blockRows } = await supabase
            .from("user_blocks")
            .select("blocker_id, blocked_id")
            .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

          for (const block of (blockRows ?? []) as BlockRow[]) {
            hiddenUserIds.add(
              block.blocker_id === userId ? block.blocked_id : block.blocker_id
            );
          }
        }

        const { data: discussionRows, error: discussionError } = await supabase
          .from("discussions")
          .select(
            "id, user_id, title, body, topic, reality_lens, purpose_lane, created_at"
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (discussionError) throw discussionError;

        const visibleDiscussions = ((discussionRows ?? []) as Discussion[]).filter(
          (discussion) => !hiddenUserIds.has(discussion.user_id)
        );
        const discussionIds = visibleDiscussions.map((discussion) => discussion.id);
        const authorIds = [
          ...new Set(visibleDiscussions.map((discussion) => discussion.user_id)),
        ];

        const [profileResult, replyResult, viewResult, saveResult, alertResult] =
          await Promise.all([
            authorIds.length
              ? supabase
                  .from("profiles")
                  .select("id, full_name, username")
                  .in("id", authorIds)
              : Promise.resolve({ data: [], error: null }),
            discussionIds.length
              ? supabase
                  .from("replies")
                  .select("discussion_id, user_id")
                  .in("discussion_id", discussionIds)
                  .is("deleted_at", null)
              : Promise.resolve({ data: [], error: null }),
            discussionIds.length
              ? supabase
                  .from("discussion_views")
                  .select("discussion_id")
                  .in("discussion_id", discussionIds)
              : Promise.resolve({ data: [], error: null }),
            discussionIds.length
              ? supabase
                  .from("bookmarks")
                  .select("discussion_id")
                  .in("discussion_id", discussionIds)
              : Promise.resolve({ data: [], error: null }),
            accessToken
              ? fetch("/api/topic-follows", {
                  headers: { Authorization: `Bearer ${accessToken}` },
                })
              : Promise.resolve(null),
          ]);

        const nextProfiles = Object.fromEntries(
          ((profileResult.data ?? []) as Profile[]).map((profile) => [
            profile.id,
            profile,
          ])
        );
        const nextReplyCounts: Record<string, number> = {};
        const nextViewCounts: Record<string, number> = {};
        const nextSaveCounts: Record<string, number> = {};

        for (const reply of replyResult.data ?? []) {
          if (hiddenUserIds.has(reply.user_id)) continue;
          nextReplyCounts[reply.discussion_id] =
            (nextReplyCounts[reply.discussion_id] ?? 0) + 1;
        }

        for (const view of viewResult.data ?? []) {
          nextViewCounts[view.discussion_id] =
            (nextViewCounts[view.discussion_id] ?? 0) + 1;
        }

        for (const save of saveResult.data ?? []) {
          nextSaveCounts[save.discussion_id] =
            (nextSaveCounts[save.discussion_id] ?? 0) + 1;
        }

        if (mounted) {
          setDiscussions(visibleDiscussions);
          setProfiles(nextProfiles);
          setReplyCounts(nextReplyCounts);
          setViewCounts(nextViewCounts);
          setSaveCounts(nextSaveCounts);
        }

        if (alertResult) {
          const payload = await alertResult.json().catch(() => ({}));

          if (mounted && alertResult.ok) {
            setFollowedTopics(
              Array.isArray(payload.selectedTopics) ? payload.selectedTopics : []
            );
          }
        } else if (mounted) {
          setCanFollowTopics(false);
          setFollowedTopics([]);
        }
      } catch (error) {
        console.error("Unable to load the Signal Directory.", error);
        if (mounted) {
          setDiscussions([]);
          setMessage("The Signal Directory could not load. Refresh and try again.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadDirectory();

    return () => {
      mounted = false;
    };
  }, []);

  const followedSet = useMemo(() => new Set(followedTopics), [followedTopics]);

  async function toggleTopicFollow(topic: string) {
    if (savingTopic) return;

    if (!viewerId) {
      window.location.href = `/login?next=${encodeURIComponent(
        `/topics?dimension=topic&value=${encodeURIComponent(topic)}`
      )}`;
      return;
    }

    const wasFollowing = followedSet.has(topic);
    const nextTopics = wasFollowing
      ? followedTopics.filter((value) => value !== topic)
      : [...followedTopics, topic];

    setSavingTopic(topic);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login?next=/topics";
        return;
      }

      const response = await fetch("/api/topic-follows", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topics: nextTopics }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to update this topic.");
        return;
      }

      setFollowedTopics(
        Array.isArray(result.selectedTopics) ? result.selectedTopics : nextTopics
      );
      setMessage(
        wasFollowing
          ? `${topic} removed from Following.`
          : `${topic} added to Following. New-discussion alerts are on.`
      );
    } catch {
      setMessage("Unable to update this topic. Try again.");
    } finally {
      setSavingTopic(null);
    }
  }

  return {
    discussions,
    profiles,
    replyCounts,
    viewCounts,
    saveCounts,
    viewerId,
    canFollowTopics,
    followedSet,
    savingTopic,
    loading,
    message,
    setMessage,
    toggleTopicFollow,
  };
}
