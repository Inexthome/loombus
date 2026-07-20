"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Ban,
  CheckCircle2,
  Copy,
  Ellipsis,
  ExternalLink,
  Flag,
  Link2,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  StickyNote,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import {
  DEFAULT_REPORT_REASON,
  REPORT_REASONS,
  type ReportReason,
} from "@/lib/report-reasons";
import { supabase } from "@/lib/supabase/client";
import styles from "./discussion-detail-actions-layer.module.css";

type DiscussionRecord = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  body: string;
  reality_lens: string | null;
  purpose_lane: string | null;
  discussion_status: "open" | "resolved" | null;
  pinned_reply_id: string | null;
  created_at: string;
};

type ReplyRecord = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
  username: string | null;
};

type RelatedDiscussion = {
  id: string;
  title: string;
  topic: string;
  created_at: string;
};

type MenuTarget =
  | { type: "discussion" }
  | { type: "reply"; replyId: string }
  | null;

type ReportTarget =
  | { type: "discussion" }
  | { type: "reply"; replyId: string }
  | { type: "profile"; profileId: string }
  | null;

type EditDiscussionState = {
  title: string;
  topic: string;
  body: string;
  realityLens: string;
  purposeLane: string;
};

function profileName(profile?: ProfileRecord | null) {
  return profile?.full_name?.trim() || profile?.username || "Loombus member";
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(parsed)
    : "";
}

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export default function DiscussionDetailActionsLayer() {
  const params = useParams();
  const router = useRouter();
  const discussionId = String(params.id ?? "");

  const [mounted, setMounted] = useState(false);
  const [portalVersion, setPortalVersion] = useState(0);
  const [discussion, setDiscussion] = useState<DiscussionRecord | null>(null);
  const [replies, setReplies] = useState<ReplyRecord[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRecord>>({});
  const [relatedDiscussions, setRelatedDiscussions] = useState<RelatedDiscussion[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canUsePremium, setCanUsePremium] = useState(false);
  const [isStickied, setIsStickied] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followsViewerIds, setFollowsViewerIds] = useState<Set<string>>(new Set());
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [blockedByIds, setBlockedByIds] = useState<Set<string>>(new Set());
  const [reportedDiscussion, setReportedDiscussion] = useState(false);
  const [reportedReplyIds, setReportedReplyIds] = useState<Set<string>>(new Set());
  const [reportedProfileIds, setReportedProfileIds] = useState<Set<string>>(new Set());
  const [menuTarget, setMenuTarget] = useState<MenuTarget>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget>(null);
  const [reportReason, setReportReason] = useState<ReportReason>(DEFAULT_REPORT_REASON);
  const [editDiscussion, setEditDiscussion] = useState<EditDiscussionState | null>(null);
  const [editReply, setEditReply] = useState<ReplyRecord | null>(null);
  const [editReplyBody, setEditReplyBody] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!discussionId) return;

    const [discussionResult, repliesResult, viewerResult] = await Promise.all([
      supabase
        .from("discussions")
        .select(
          "id, user_id, title, topic, body, reality_lens, purpose_lane, discussion_status, pinned_reply_id, created_at"
        )
        .eq("id", discussionId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("replies")
        .select("id, user_id, body, created_at")
        .eq("discussion_id", discussionId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      supabase.auth.getUser(),
    ]);

    const discussionRow = (discussionResult.data ?? null) as DiscussionRecord | null;
    const replyRows = (repliesResult.data ?? []) as ReplyRecord[];
    const viewer = viewerResult.data.user;

    if (!discussionRow) return;

    setDiscussion(discussionRow);
    setReplies(replyRows);
    setViewerId(viewer?.id ?? null);

    const profileIds = [...new Set([discussionRow.user_id, ...replyRows.map((reply) => reply.user_id)])];
    const [{ data: profileRows }, { data: relatedRows }] = await Promise.all([
      profileIds.length
        ? supabase
            .from("profiles")
            .select("id, full_name, username")
            .in("id", profileIds)
        : Promise.resolve({ data: [] as ProfileRecord[] }),
      supabase
        .from("discussions")
        .select("id, title, topic, created_at")
        .eq("topic", discussionRow.topic)
        .neq("id", discussionId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(4),
    ]);

    setProfiles(
      Object.fromEntries(
        ((profileRows ?? []) as ProfileRecord[]).map((profile) => [profile.id, profile])
      )
    );
    setRelatedDiscussions((relatedRows ?? []) as RelatedDiscussion[]);

    if (!viewer) return;

    const targetProfileIds = profileIds.filter((profileId) => profileId !== viewer.id);
    const replyIds = replyRows.map((reply) => reply.id);

    const [
      viewerProfileResult,
      entitlementResult,
      discussionReportResult,
      replyReportsResult,
      profileReportsResult,
      outgoingFollowsResult,
      incomingFollowsResult,
      blocksResult,
    ] = await Promise.all([
      supabase.from("profiles").select("is_admin").eq("id", viewer.id).maybeSingle(),
      supabase
        .from("user_ai_entitlements")
        .select("tier, ai_assisted_enabled")
        .eq("user_id", viewer.id)
        .maybeSingle(),
      supabase
        .from("reports")
        .select("id")
        .eq("reporter_id", viewer.id)
        .eq("discussion_id", discussionId)
        .is("reply_id", null)
        .maybeSingle(),
      replyIds.length
        ? supabase
            .from("reports")
            .select("reply_id")
            .eq("reporter_id", viewer.id)
            .in("reply_id", replyIds)
        : Promise.resolve({ data: [] as Array<{ reply_id: string | null }> }),
      targetProfileIds.length
        ? supabase
            .from("reports")
            .select("reported_profile_id")
            .eq("reporter_id", viewer.id)
            .in("reported_profile_id", targetProfileIds)
        : Promise.resolve({ data: [] as Array<{ reported_profile_id: string | null }> }),
      targetProfileIds.length
        ? supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", viewer.id)
            .in("following_id", targetProfileIds)
        : Promise.resolve({ data: [] as Array<{ following_id: string }> }),
      targetProfileIds.length
        ? supabase
            .from("follows")
            .select("follower_id")
            .eq("following_id", viewer.id)
            .in("follower_id", targetProfileIds)
        : Promise.resolve({ data: [] as Array<{ follower_id: string }> }),
      supabase
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${viewer.id},blocked_id.eq.${viewer.id}`),
    ]);

    const viewerIsAdmin = Boolean(
      (viewerProfileResult.data as { is_admin?: boolean | null } | null)?.is_admin
    );
    const entitlement = entitlementResult.data as
      | { tier?: string | null; ai_assisted_enabled?: boolean | null }
      | null;

    setIsAdmin(viewerIsAdmin);
    setCanUsePremium(
      viewerIsAdmin ||
        (entitlement?.ai_assisted_enabled === true &&
          ["premium", "premium_plus"].includes(entitlement.tier ?? ""))
    );
    setReportedDiscussion(Boolean(discussionReportResult.data));
    setReportedReplyIds(
      new Set(
        ((replyReportsResult.data ?? []) as Array<{ reply_id: string | null }>)
          .map((row) => row.reply_id)
          .filter((replyId): replyId is string => Boolean(replyId))
      )
    );
    setReportedProfileIds(
      new Set(
        ((profileReportsResult.data ?? []) as Array<{ reported_profile_id: string | null }>)
          .map((row) => row.reported_profile_id)
          .filter((profileId): profileId is string => Boolean(profileId))
      )
    );
    setFollowingIds(
      new Set(
        ((outgoingFollowsResult.data ?? []) as Array<{ following_id: string }>).map(
          (row) => row.following_id
        )
      )
    );
    setFollowsViewerIds(
      new Set(
        ((incomingFollowsResult.data ?? []) as Array<{ follower_id: string }>).map(
          (row) => row.follower_id
        )
      )
    );

    const blocked = new Set<string>();
    const blockedBy = new Set<string>();
    for (const row of (blocksResult.data ?? []) as Array<{
      blocker_id: string;
      blocked_id: string;
    }>) {
      if (row.blocker_id === viewer.id) blocked.add(row.blocked_id);
      if (row.blocked_id === viewer.id) blockedBy.add(row.blocker_id);
    }
    setBlockedIds(blocked);
    setBlockedByIds(blockedBy);

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (token && (viewerIsAdmin || entitlement?.ai_assisted_enabled)) {
      const response = await fetch("/api/stickies", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await readJson(response);
      const stickies = Array.isArray(result.stickies)
        ? (result.stickies as Array<{ source_key?: string }>)
        : [];
      setIsStickied(response.ok && stickies.some((sticky) => sticky.source_key === discussionId));
    }
  }, [discussionId]);

  useEffect(() => {
    setMounted(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!mounted) return;
    const refreshTargets = () => setPortalVersion((value) => value + 1);
    const observer = new MutationObserver(refreshTargets);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setTimeout(refreshTargets, 50);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const mobileBar = document.querySelector<HTMLElement>(".discussion-v2-mobile-bar");
    if (!mobileBar) return;
    const previous = mobileBar.style.gridTemplateColumns;
    mobileBar.style.gridTemplateColumns = "1fr auto auto auto";
    return () => {
      mobileBar.style.gridTemplateColumns = previous;
    };
  }, [mounted, portalVersion]);

  const getToken = useCallback(async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token ?? null;
    if (!token) {
      router.push(`/login?next=${encodeURIComponent(`/discussions/${discussionId}`)}`);
    }
    return token;
  }, [discussionId, router]);

  const authorProfile = discussion ? profiles[discussion.user_id] : null;
  const canManageDiscussion = Boolean(
    discussion && viewerId && (viewerId === discussion.user_id || isAdmin)
  );

  const selectedReply = useMemo(
    () =>
      menuTarget?.type === "reply"
        ? replies.find((reply) => reply.id === menuTarget.replyId) ?? null
        : null,
    [menuTarget, replies]
  );

  const selectedProfile = selectedReply ? profiles[selectedReply.user_id] : authorProfile;
  const selectedProfileId = selectedReply?.user_id ?? discussion?.user_id ?? null;
  const selectedIsSelf = Boolean(viewerId && selectedProfileId === viewerId);
  const selectedIsBlocked = Boolean(selectedProfileId && blockedIds.has(selectedProfileId));
  const selectedBlockedViewer = Boolean(selectedProfileId && blockedByIds.has(selectedProfileId));
  const selectedIsFollowing = Boolean(selectedProfileId && followingIds.has(selectedProfileId));
  const selectedIsMutual = Boolean(
    selectedProfileId &&
      followingIds.has(selectedProfileId) &&
      followsViewerIds.has(selectedProfileId)
  );

  function clearMessages() {
    setNotice("");
    setError("");
  }

  async function copyUrl(replyId?: string) {
    clearMessages();
    const url = `${window.location.origin}/discussions/${discussionId}${
      replyId ? `#reply-${replyId}` : ""
    }`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice(replyId ? "Reply link copied." : "Discussion link copied.");
    } catch {
      setError("The link could not be copied on this device.");
    }
  }

  async function toggleFollow(profileId: string) {
    clearMessages();
    const token = await getToken();
    if (!token) return;
    setBusy(`follow:${profileId}`);
    try {
      const response = await fetch("/api/follows/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId: profileId }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "Unable to update follow status."));
      setFollowingIds((current) => {
        const next = new Set(current);
        if (result.following) next.add(profileId);
        else next.delete(profileId);
        return next;
      });
      setNotice(result.following ? "Member followed." : "Member unfollowed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update follow status.");
    } finally {
      setBusy("");
    }
  }

  async function startMessage(profileId: string) {
    clearMessages();
    const token = await getToken();
    if (!token) return;
    setBusy(`message:${profileId}`);
    try {
      const response = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId: profileId }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "Unable to start message."));
      const conversationId = String(result.conversationId ?? "");
      if (!conversationId) throw new Error("The conversation could not be opened.");
      router.push(`/messages?conversation=${encodeURIComponent(conversationId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start message.");
      setBusy("");
    }
  }

  async function blockProfile(profileId: string) {
    clearMessages();
    if (!window.confirm("Block this member? Their content and direct interactions will be hidden.")) {
      return;
    }
    const token = await getToken();
    if (!token) return;
    setBusy(`block:${profileId}`);
    try {
      const response = await fetch("/api/blocks/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId: profileId }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "Unable to block member."));
      if (!result.blocked) {
        setError("The member was not blocked.");
        return;
      }
      setBlockedIds((current) => new Set(current).add(profileId));
      setMenuTarget(null);
      if (discussion?.user_id === profileId) {
        router.push("/discussions");
        router.refresh();
      } else {
        window.location.reload();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to block member.");
    } finally {
      setBusy("");
    }
  }

  async function submitReport() {
    if (!reportTarget) return;
    clearMessages();
    const token = await getToken();
    if (!token) return;
    setBusy("report");
    try {
      const payload =
        reportTarget.type === "discussion"
          ? { targetType: "discussion", discussionId, reason: reportReason }
          : reportTarget.type === "reply"
            ? {
                targetType: "reply",
                discussionId,
                replyId: reportTarget.replyId,
                reason: reportReason,
              }
            : {
                targetType: "profile",
                profileId: reportTarget.profileId,
                reason: reportReason,
              };
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await readJson(response);
      if (!response.ok && response.status !== 409) {
        throw new Error(String(result.error ?? "Unable to submit report."));
      }
      if (reportTarget.type === "discussion") setReportedDiscussion(true);
      if (reportTarget.type === "reply") {
        setReportedReplyIds((current) => new Set(current).add(reportTarget.replyId));
      }
      if (reportTarget.type === "profile") {
        setReportedProfileIds((current) => new Set(current).add(reportTarget.profileId));
      }
      setNotice(
        reportTarget.type === "discussion"
          ? "Discussion reported."
          : reportTarget.type === "reply"
            ? "Reply reported."
            : "Person reported."
      );
      setReportTarget(null);
      setMenuTarget(null);
      setReportReason(DEFAULT_REPORT_REASON);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit report.");
    } finally {
      setBusy("");
    }
  }

  async function addToStickies() {
    clearMessages();
    const token = await getToken();
    if (!token) return;
    setBusy("sticky");
    try {
      const response = await fetch("/api/stickies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ discussionId }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "Unable to add to Stickies."));
      setIsStickied(true);
      setNotice("Added to Stickies.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add to Stickies.");
    } finally {
      setBusy("");
    }
  }

  async function updateStatus() {
    if (!discussion) return;
    clearMessages();
    const token = await getToken();
    if (!token) return;
    const nextStatus = discussion.discussion_status === "resolved" ? "open" : "resolved";
    setBusy("status");
    try {
      const response = await fetch("/api/discussions/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ discussionId, status: nextStatus }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "Unable to update discussion status."));
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update discussion status.");
      setBusy("");
    }
  }

  async function saveDiscussionEdit() {
    if (!editDiscussion) return;
    clearMessages();
    if (!editDiscussion.title.trim() || !editDiscussion.body.trim()) {
      setError("The Discussion title and content are required.");
      return;
    }
    const token = await getToken();
    if (!token) return;
    setBusy("edit-discussion");
    try {
      const response = await fetch("/api/discussions/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          discussionId,
          title: editDiscussion.title,
          topic: editDiscussion.topic,
          body: editDiscussion.body,
          realityLens: editDiscussion.realityLens,
          purposeLane: editDiscussion.purposeLane,
        }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "Unable to update Discussion."));
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update Discussion.");
      setBusy("");
    }
  }

  async function deleteDiscussion() {
    clearMessages();
    if (!window.confirm("Delete this Discussion? It will be removed from public view.")) return;
    const token = await getToken();
    if (!token) return;
    setBusy("delete-discussion");
    try {
      const response = await fetch("/api/discussions/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ discussionId }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "Unable to delete Discussion."));
      router.push("/discussions");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete Discussion.");
      setBusy("");
    }
  }

  async function saveReplyEdit() {
    if (!editReply) return;
    clearMessages();
    if (!editReplyBody.trim()) {
      setError("Reply content is required.");
      return;
    }
    const token = await getToken();
    if (!token) return;
    setBusy(`edit-reply:${editReply.id}`);
    try {
      const response = await fetch("/api/replies/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ replyId: editReply.id, body: editReplyBody }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "Unable to update reply."));
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update reply.");
      setBusy("");
    }
  }

  async function deleteReply(replyId: string) {
    clearMessages();
    if (!window.confirm("Delete this reply? It will be removed from public view.")) return;
    const token = await getToken();
    if (!token) return;
    setBusy(`delete-reply:${replyId}`);
    try {
      const response = await fetch("/api/replies/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ replyId }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "Unable to delete reply."));
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete reply.");
      setBusy("");
    }
  }

  async function togglePin(replyId: string) {
    if (!discussion) return;
    clearMessages();
    const token = await getToken();
    if (!token) return;
    const unpin = discussion.pinned_reply_id === replyId;
    setBusy(`pin:${replyId}`);
    try {
      const response = await fetch("/api/discussions/pin-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ discussionId, replyId, unpin }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(String(result.error ?? "Unable to update pinned reply."));
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update pinned reply.");
      setBusy("");
    }
  }

  function openDiscussionEdit() {
    if (!discussion) return;
    setMenuTarget(null);
    setEditDiscussion({
      title: discussion.title,
      topic: discussion.topic,
      body: discussion.body,
      realityLens: discussion.reality_lens ?? "",
      purposeLane: discussion.purpose_lane ?? "",
    });
  }

  function openReplyEdit(reply: ReplyRecord) {
    setMenuTarget(null);
    setEditReply(reply);
    setEditReplyBody(reply.body);
  }

  function openReport(target: Exclude<ReportTarget, null>) {
    setMenuTarget(null);
    setReportReason(DEFAULT_REPORT_REASON);
    setReportTarget(target);
  }

  function respondToReply(replyId: string) {
    const root = document.getElementById(`reply-${replyId}`) ??
      (discussion?.pinned_reply_id === replyId
        ? document.querySelector<HTMLElement>(".discussion-v2-reply-card.is-pinned")
        : null);
    const button = Array.from(root?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
      (candidate) => candidate.textContent?.includes("Respond to point")
    );
    setMenuTarget(null);
    button?.click();
  }

  const openingActions = mounted
    ? document.querySelector<HTMLElement>(".discussion-v2-opening-actions")
    : null;
  const mobileBar = mounted
    ? document.querySelector<HTMLElement>(".discussion-v2-mobile-bar")
    : null;
  const rightRailStack = mounted
    ? document.querySelector<HTMLElement>(
        ".discussion-v2-right-rail .discussion-v2-sticky-stack"
      )
    : null;

  const actionTrigger = (label: string, compact = false) => (
    <button
      type="button"
      className={compact ? styles.compactTrigger : styles.trigger}
      aria-label={label}
      onClick={() => setMenuTarget({ type: "discussion" })}
    >
      <Ellipsis aria-hidden="true" size={compact ? 19 : 17} />
      {!compact ? "More" : null}
    </button>
  );

  const replyPortals = mounted
    ? replies.map((reply) => {
        const footer =
          discussion?.pinned_reply_id === reply.id
            ? document.querySelector<HTMLElement>(
                ".discussion-v2-reply-card.is-pinned .discussion-v2-reply-footer"
              )
            : document
                .getElementById(`reply-${reply.id}`)
                ?.querySelector<HTMLElement>(".discussion-v2-reply-footer") ?? null;
        if (!footer) return null;
        return createPortal(
          <button
            type="button"
            className={styles.replyTrigger}
            aria-label="More reply actions"
            onClick={() => setMenuTarget({ type: "reply", replyId: reply.id })}
          >
            <Ellipsis aria-hidden="true" size={16} />
            More
          </button>,
          footer,
          `reply-actions-${reply.id}`
        );
      })
    : [];

  const reportLabel =
    reportTarget?.type === "discussion"
      ? "Discussion"
      : reportTarget?.type === "reply"
        ? "Reply"
        : "Person";

  return (
    <>
      {openingActions
        ? createPortal(actionTrigger("Open Discussion actions"), openingActions)
        : null}
      {mobileBar
        ? createPortal(actionTrigger("Open more Discussion actions", true), mobileBar)
        : null}
      {rightRailStack
        ? createPortal(
            <section className={`discussion-v2-side-card ${styles.rightRailCard}`}>
              <p className="discussion-v2-rail-label">Safety and actions</p>
              <p className={styles.rightRailCopy}>
                Report content or a person, manage your own Discussion, or copy a direct link.
              </p>
              <button
                type="button"
                className={styles.rightRailButton}
                onClick={() => setMenuTarget({ type: "discussion" })}
              >
                <Ellipsis aria-hidden="true" size={17} />
                Open all actions
              </button>
            </section>,
            rightRailStack
          )
        : null}
      {replyPortals}

      {(notice || error) && (
        <div className={`${styles.toast} ${error ? styles.toastError : ""}`} role="status">
          <span>{error || notice}</span>
          <button type="button" aria-label="Close message" onClick={clearMessages}>
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      )}

      {menuTarget && discussion ? (
        <div
          className={styles.backdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMenuTarget(null);
          }}
        >
          <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="discussion-actions-title">
            <header className={styles.sheetHeader}>
              <div>
                <p>{menuTarget.type === "reply" ? "Reply actions" : "Discussion actions"}</p>
                <h2 id="discussion-actions-title">
                  {menuTarget.type === "reply" ? "Choose an action for this reply." : "Choose an action for this Discussion."}
                </h2>
              </div>
              <button type="button" aria-label="Close actions" onClick={() => setMenuTarget(null)}>
                <X aria-hidden="true" size={19} />
              </button>
            </header>

            <div className={styles.sheetBody}>
              <section className={styles.actionSection}>
                <h3>{menuTarget.type === "reply" ? "Reply" : "Discussion"}</h3>
                <div className={styles.actionGrid}>
                  {menuTarget.type === "reply" && selectedReply ? (
                    <>
                      <button type="button" onClick={() => respondToReply(selectedReply.id)}>
                        <MessageCircle aria-hidden="true" size={18} />
                        <span><strong>Respond to point</strong><small>Reference this reply in your response.</small></span>
                      </button>
                      <button type="button" onClick={() => void copyUrl(selectedReply.id)}>
                        <Copy aria-hidden="true" size={18} />
                        <span><strong>Copy link to this reply</strong><small>Share a direct link to this exact point.</small></span>
                      </button>
                      {canManageDiscussion ? (
                        <button type="button" disabled={Boolean(busy)} onClick={() => void togglePin(selectedReply.id)}>
                          {discussion.pinned_reply_id === selectedReply.id ? <PinOff aria-hidden="true" size={18} /> : <Pin aria-hidden="true" size={18} />}
                          <span><strong>{discussion.pinned_reply_id === selectedReply.id ? "Unpin reply" : "Pin reply"}</strong><small>Control the highlighted reply for this thread.</small></span>
                        </button>
                      ) : null}
                      {viewerId && (viewerId === selectedReply.user_id || isAdmin) ? (
                        <button type="button" onClick={() => openReplyEdit(selectedReply)}>
                          <Pencil aria-hidden="true" size={18} />
                          <span><strong>Edit reply</strong><small>The existing edit-window rules still apply.</small></span>
                        </button>
                      ) : null}
                      {viewerId && (viewerId === selectedReply.user_id || isAdmin) ? (
                        <button className={styles.dangerAction} type="button" disabled={Boolean(busy)} onClick={() => void deleteReply(selectedReply.id)}>
                          <Trash2 aria-hidden="true" size={18} />
                          <span><strong>Delete reply</strong><small>Remove this reply from public view.</small></span>
                        </button>
                      ) : null}
                      {!selectedIsSelf ? (
                        <button type="button" disabled={reportedReplyIds.has(selectedReply.id)} onClick={() => openReport({ type: "reply", replyId: selectedReply.id })}>
                          <Flag aria-hidden="true" size={18} />
                          <span><strong>{reportedReplyIds.has(selectedReply.id) ? "Reply reported" : "Report reply"}</strong><small>Report the content of this reply.</small></span>
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => void copyUrl()}>
                        <Link2 aria-hidden="true" size={18} />
                        <span><strong>Copy Discussion link</strong><small>Share a direct link to this thread.</small></span>
                      </button>
                      {canUsePremium ? (
                        <button type="button" disabled={isStickied || busy === "sticky"} onClick={() => void addToStickies()}>
                          <StickyNote aria-hidden="true" size={18} />
                          <span><strong>{isStickied ? "In Stickies" : "Add to Stickies"}</strong><small>Keep this thread in your active workspace.</small></span>
                        </button>
                      ) : (
                        <Link href="/premium" onClick={() => setMenuTarget(null)}>
                          <StickyNote aria-hidden="true" size={18} />
                          <span><strong>Unlock Stickies</strong><small>Available with Premium and Premium Plus.</small></span>
                        </Link>
                      )}
                      <Link href={`/topics/${encodeURIComponent(discussion.topic)}`} onClick={() => setMenuTarget(null)}>
                        <ExternalLink aria-hidden="true" size={18} />
                        <span><strong>Related discussions</strong><small>Continue through the {discussion.topic} topic.</small></span>
                      </Link>
                      {canManageDiscussion ? (
                        <button type="button" onClick={openDiscussionEdit}>
                          <Pencil aria-hidden="true" size={18} />
                          <span><strong>Edit Discussion</strong><small>The existing owner and edit-window rules still apply.</small></span>
                        </button>
                      ) : null}
                      {canManageDiscussion ? (
                        <button type="button" disabled={busy === "status"} onClick={() => void updateStatus()}>
                          {discussion.discussion_status === "resolved" ? <RotateCcw aria-hidden="true" size={18} /> : <CheckCircle2 aria-hidden="true" size={18} />}
                          <span><strong>{discussion.discussion_status === "resolved" ? "Reopen Discussion" : "Mark resolved"}</strong><small>Update the thread status.</small></span>
                        </button>
                      ) : null}
                      {canManageDiscussion ? (
                        <button className={styles.dangerAction} type="button" disabled={busy === "delete-discussion"} onClick={() => void deleteDiscussion()}>
                          <Trash2 aria-hidden="true" size={18} />
                          <span><strong>Delete Discussion</strong><small>Remove this thread from public view.</small></span>
                        </button>
                      ) : null}
                      {!canManageDiscussion ? (
                        <button type="button" disabled={reportedDiscussion} onClick={() => openReport({ type: "discussion" })}>
                          <Flag aria-hidden="true" size={18} />
                          <span><strong>{reportedDiscussion ? "Discussion reported" : "Report Discussion"}</strong><small>Report the opening post and thread context.</small></span>
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </section>

              {selectedProfileId && !selectedIsSelf ? (
                <section className={styles.actionSection}>
                  <h3>{menuTarget.type === "reply" ? "Reply author" : "Discussion author"}</h3>
                  <div className={styles.personSummary}>
                    <UserRound aria-hidden="true" size={20} />
                    <span><strong>{profileName(selectedProfile)}</strong><small>{selectedProfile?.username ? `@${selectedProfile.username}` : "Loombus member"}</small></span>
                  </div>
                  <div className={styles.actionGrid}>
                    {selectedProfile?.username ? (
                      <Link href={`/u/${selectedProfile.username}`} onClick={() => setMenuTarget(null)}>
                        <ExternalLink aria-hidden="true" size={18} />
                        <span><strong>View profile</strong><small>Open this person’s public Loombus identity.</small></span>
                      </Link>
                    ) : null}
                    {!selectedIsBlocked && !selectedBlockedViewer ? (
                      <button type="button" disabled={busy === `follow:${selectedProfileId}`} onClick={() => void toggleFollow(selectedProfileId)}>
                        <UserPlus aria-hidden="true" size={18} />
                        <span><strong>{selectedIsFollowing ? "Unfollow person" : "Follow person"}</strong><small>Update whether their Signal appears in your network.</small></span>
                      </button>
                    ) : null}
                    {selectedIsMutual && !selectedIsBlocked && !selectedBlockedViewer ? (
                      <button type="button" disabled={busy === `message:${selectedProfileId}`} onClick={() => void startMessage(selectedProfileId)}>
                        <MessageCircle aria-hidden="true" size={18} />
                        <span><strong>Message person</strong><small>Open a private conversation with this mutual connection.</small></span>
                      </button>
                    ) : null}
                    <button type="button" disabled={reportedProfileIds.has(selectedProfileId)} onClick={() => openReport({ type: "profile", profileId: selectedProfileId })}>
                      <Flag aria-hidden="true" size={18} />
                      <span><strong>{reportedProfileIds.has(selectedProfileId) ? "Person reported" : "Report person"}</strong><small>Report this member’s account or behavior.</small></span>
                    </button>
                    {!selectedIsBlocked ? (
                      <button className={styles.dangerAction} type="button" disabled={busy === `block:${selectedProfileId}`} onClick={() => void blockProfile(selectedProfileId)}>
                        <Ban aria-hidden="true" size={18} />
                        <span><strong>Block person</strong><small>Hide their content and stop direct interaction.</small></span>
                      </button>
                    ) : (
                      <div className={styles.blockedState}><Ban aria-hidden="true" size={18} /><span><strong>Person blocked</strong><small>Manage blocked members from Settings.</small></span></div>
                    )}
                  </div>
                </section>
              ) : null}

              {menuTarget.type === "discussion" && relatedDiscussions.length > 0 ? (
                <section className={styles.actionSection}>
                  <h3>Related discussions</h3>
                  <div className={styles.relatedList}>
                    {relatedDiscussions.map((related) => (
                      <Link key={related.id} href={`/discussions/${related.id}`} onClick={() => setMenuTarget(null)}>
                        <span>{related.topic}</span>
                        <strong>{related.title}</strong>
                        <small>{formatDate(related.created_at)}</small>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {reportTarget ? (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportTarget(null); }}>
          <section className={`${styles.sheet} ${styles.smallSheet}`} role="dialog" aria-modal="true" aria-labelledby="report-target-title">
            <header className={styles.sheetHeader}>
              <div><p>Safety report</p><h2 id="report-target-title">Report {reportLabel}</h2></div>
              <button type="button" aria-label="Close report" onClick={() => setReportTarget(null)}><X aria-hidden="true" size={19} /></button>
            </header>
            <div className={styles.formBody}>
              <label>Reason<select value={reportReason} onChange={(event) => setReportReason(event.target.value as ReportReason)}>{REPORT_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label>
              <p>Reports are reviewed against Loombus safety and platform policies. Reporting content and reporting a person are separate actions.</p>
            </div>
            <footer className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => setReportTarget(null)}>Cancel</button>
              <button type="button" className={styles.dangerButton} disabled={busy === "report"} onClick={() => void submitReport()}>{busy === "report" ? <LoaderCircle className={styles.spinning} size={17} /> : <Flag size={17} />}Submit report</button>
            </footer>
          </section>
        </div>
      ) : null}

      {editDiscussion ? (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditDiscussion(null); }}>
          <section className={styles.editor} role="dialog" aria-modal="true" aria-labelledby="edit-discussion-title">
            <header className={styles.sheetHeader}>
              <div><p>Owner and Admin action</p><h2 id="edit-discussion-title">Edit Discussion</h2></div>
              <button type="button" aria-label="Close editor" onClick={() => setEditDiscussion(null)}><X aria-hidden="true" size={19} /></button>
            </header>
            <div className={styles.editorGrid}>
              <label className={styles.fullField}>Title<input value={editDiscussion.title} maxLength={180} onChange={(event) => setEditDiscussion((current) => current ? { ...current, title: event.target.value } : current)} /></label>
              <label>Topic<select value={editDiscussion.topic} onChange={(event) => setEditDiscussion((current) => current ? { ...current, topic: event.target.value } : current)}>{DISCUSSION_TOPICS.map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select></label>
              <label>Reality Lens<input value={editDiscussion.realityLens} onChange={(event) => setEditDiscussion((current) => current ? { ...current, realityLens: event.target.value } : current)} /></label>
              <label>Purpose Lane<input value={editDiscussion.purposeLane} onChange={(event) => setEditDiscussion((current) => current ? { ...current, purposeLane: event.target.value } : current)} /></label>
              <label className={styles.fullField}>Discussion content<textarea rows={12} maxLength={12000} value={editDiscussion.body} onChange={(event) => setEditDiscussion((current) => current ? { ...current, body: event.target.value } : current)} /></label>
            </div>
            <p className={styles.editorHelp}>The existing Free, Premium, Premium Plus, and Admin edit windows remain enforced by the server. Structured-mode metadata and attachments are not changed here.</p>
            <footer className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => setEditDiscussion(null)}>Cancel</button>
              <button type="button" className={styles.primaryButton} disabled={busy === "edit-discussion"} onClick={() => void saveDiscussionEdit()}>{busy === "edit-discussion" ? <LoaderCircle className={styles.spinning} size={17} /> : <Pencil size={17} />}Save changes</button>
            </footer>
          </section>
        </div>
      ) : null}

      {editReply ? (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditReply(null); }}>
          <section className={`${styles.editor} ${styles.smallSheet}`} role="dialog" aria-modal="true" aria-labelledby="edit-reply-title">
            <header className={styles.sheetHeader}>
              <div><p>Reply management</p><h2 id="edit-reply-title">Edit reply</h2></div>
              <button type="button" aria-label="Close reply editor" onClick={() => setEditReply(null)}><X aria-hidden="true" size={19} /></button>
            </header>
            <div className={styles.formBody}><label>Reply<textarea rows={9} maxLength={5000} value={editReplyBody} onChange={(event) => setEditReplyBody(event.target.value)} /></label><p>{editReplyBody.length}/5000 characters. Existing reply edit permissions remain enforced by the server.</p></div>
            <footer className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => setEditReply(null)}>Cancel</button>
              <button type="button" className={styles.primaryButton} disabled={busy === `edit-reply:${editReply.id}`} onClick={() => void saveReplyEdit()}>{busy === `edit-reply:${editReply.id}` ? <LoaderCircle className={styles.spinning} size={17} /> : <Pencil size={17} />}Save reply</button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
