"use client";

import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";
import { getSubscriptionDisplay, getSubscriptionDisplayKey } from "@/lib/subscription-plans";
import {
  DEFAULT_REPORT_REASON,
  type ReportReason,
} from "@/lib/report-reasons";
import {
  getSafetyWarningFromResult,
  type SafetyWarningState,
} from "@/components/safety-warning-modal";
import {
  type AiEntitlement,
  type AiOutputRatings,
  type AiOutputRatingValue,
  type AiToolKey,
  type BlockRow,
  type BookmarkCollection,
  type Discussion,
  type DiscussionAttachment,
  type DiscussionSummary,
  type Profile,
  type RelatedDiscussion,
  type Reply,
  type ReplyReactionCounts,
  type ReplyReactionRow,
  type ReplyReactionType,
  getReactionTotal,
} from "./discussion-detail-v2-model";

export type ReplySort = "best" | "newest" | "oldest";
export type ReportTarget =
  | { type: "discussion" }
  | { type: "reply"; replyId: string }
  | null;

const AI_ENDPOINTS: Record<
  Exclude<AiToolKey, "summary">,
  { endpoint: string; resultKey: string; error: string }
> = {
  keyTakeaways: {
    endpoint: "/api/discussions/key-takeaways",
    resultKey: "takeaways",
    error: "Unable to generate key takeaways.",
  },
  whatChanged: {
    endpoint: "/api/discussions/what-changed",
    resultKey: "whatChanged",
    error: "Unable to generate what-changed analysis.",
  },
  disagreementMap: {
    endpoint: "/api/discussions/disagreement-map",
    resultKey: "disagreementMap",
    error: "Unable to generate disagreement map.",
  },
  conversationMap: {
    endpoint: "/api/discussions/conversation-map",
    resultKey: "conversationMap",
    error: "Unable to generate conversation map.",
  },
  relatedIdeas: {
    endpoint: "/api/discussions/related-ideas",
    resultKey: "relatedIdeas",
    error: "Unable to generate related ideas.",
  },
};

function broadcastDiscussionMetricsChanged(
  discussionId: string,
  metrics: Record<string, unknown> = {}
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("loombus:discussion-metrics-changed", {
      detail: { discussionId, metrics },
    })
  );
}

export function useDiscussionDetailV2() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const composerRef = useRef<HTMLFormElement | null>(null);
  const repliesRef = useRef<HTMLElement | null>(null);

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [relatedDiscussions, setRelatedDiscussions] = useState<RelatedDiscussion[]>([]);
  const [discussionTags, setDiscussionTags] = useState<string[]>([]);
  const [discussionAttachments, setDiscussionAttachments] = useState<DiscussionAttachment[]>([]);
  const [replyProfiles, setReplyProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewerIdentityStatus, setViewerIdentityStatus] = useState("unverified");
  const [aiEntitlement, setAiEntitlement] = useState<AiEntitlement | null>(null);

  const [replyBody, setReplyBody] = useState("");
  const [pastedReplyCharacterCount, setPastedReplyCharacterCount] = useState(0);
  const [referencedReply, setReferencedReply] = useState<Reply | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyBody, setEditingReplyBody] = useState("");
  const [replySort, setReplySort] = useState<ReplySort>("best");

  const [replyReactionCounts, setReplyReactionCounts] = useState<
    Record<string, ReplyReactionCounts>
  >({});
  const [myReplyReactions, setMyReplyReactions] = useState<
    Record<string, ReplyReactionType[]>
  >({});

  const [isSaved, setIsSaved] = useState(false);
  const [savedBookmarkId, setSavedBookmarkId] = useState<string | null>(null);
  const [bookmarkCollections, setBookmarkCollections] = useState<BookmarkCollection[]>([]);
  const [selectedSaveCollectionId, setSelectedSaveCollectionId] = useState("unfiled");
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [isStickied, setIsStickied] = useState(false);

  const [reportedDiscussion, setReportedDiscussion] = useState(false);
  const [reportedReplyIds, setReportedReplyIds] = useState<string[]>([]);
  const [reportTarget, setReportTarget] = useState<ReportTarget>(null);
  const [reportReason, setReportReason] = useState<ReportReason>(DEFAULT_REPORT_REASON);

  const [discussionSummary, setDiscussionSummary] = useState<DiscussionSummary | null>(null);
  const [activeAiTool, setActiveAiTool] = useState<AiToolKey>("summary");
  const [aiResults, setAiResults] = useState<
    Partial<Record<Exclude<AiToolKey, "summary">, string>>
  >({});
  const [aiOutputRatings, setAiOutputRatings] = useState<AiOutputRatings>({});
  const [replySuggestions, setReplySuggestions] = useState("");

  const [workingAction, setWorkingAction] = useState("");
  const [reactionWorkingKey, setReactionWorkingKey] = useState("");
  const [aiWorkingKey, setAiWorkingKey] = useState("");
  const [ratingWorkingKey, setRatingWorkingKey] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [safetyWarning, setSafetyWarning] = useState<SafetyWarningState>(null);

  const resetMessages = useCallback(() => {
    setNotice("");
    setError("");
  }, []);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const requireAccessToken = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) router.push("/login");
    return token;
  }, [getAccessToken, router]);

  const trackDiscussionView = useCallback(async (discussionId: string) => {
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/discussions/view", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ discussionId }),
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (response.ok) broadcastDiscussionMetricsChanged(discussionId, result);
    } catch {
      // View tracking must never interrupt reading.
    }
  }, [getAccessToken]);

  const loadAiOutputRatings = useCallback(async (discussionId: string) => {
    const token = await getAccessToken();
    if (!token) return;
    const response = await fetch(
      `/api/ai/output-ratings?discussionId=${encodeURIComponent(discussionId)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!response.ok) return;
    const result = (await response.json().catch(() => ({}))) as {
      ratings?: AiOutputRatings;
    };
    if (result.ratings) setAiOutputRatings(result.ratings);
  }, [getAccessToken]);

  const loadDiscussion = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");

    const { data: discussionData, error: discussionError } = await supabase
      .from("discussions")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (discussionError || !discussionData) {
      setDiscussion(null);
      setLoading(false);
      return;
    }

    const discussionRow = discussionData as Discussion;
    setDiscussion(discussionRow);

    const [authorResult, repliesResult, summaryResult, tagsResult, attachmentResult, relatedResult, viewerResult] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", discussionRow.user_id).single(),
        supabase
          .from("replies")
          .select("*")
          .eq("discussion_id", id)
          .is("deleted_at", null)
          .order("created_at", { ascending: true }),
        supabase
          .from("discussion_summaries")
          .select("id, discussion_id, summary, model_name, source_reply_count, generated_at")
          .eq("discussion_id", id)
          .maybeSingle(),
        supabase
          .from("discussion_tags")
          .select("tag")
          .eq("discussion_id", id)
          .order("tag", { ascending: true }),
        supabase
          .from("discussion_attachments")
          .select(
            "id, public_url, file_name, mime_type, file_size_bytes, attachment_kind, video_duration_seconds, sort_order"
          )
          .eq("discussion_id", id)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("discussions")
          .select("id, user_id, title, topic, created_at")
          .eq("topic", discussionRow.topic)
          .neq("id", id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(4),
        supabase.auth.getUser(),
      ]);

    const viewer = viewerResult.data.user;
    const hiddenProfileIds = new Set<string>();

    if (viewer) {
      const { data: blockRows } = await supabase
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${viewer.id},blocked_id.eq.${viewer.id}`);

      for (const block of (blockRows ?? []) as BlockRow[]) {
        hiddenProfileIds.add(block.blocker_id === viewer.id ? block.blocked_id : block.blocker_id);
      }
    }

    const visibleReplies = ((repliesResult.data ?? []) as Reply[]).filter(
      (reply) => !hiddenProfileIds.has(reply.user_id)
    );
    const visibleRelated = ((relatedResult.data ?? []) as RelatedDiscussion[]).filter(
      (item) => !hiddenProfileIds.has(item.user_id)
    );
    const replyUserIds = [...new Set(visibleReplies.map((reply) => reply.user_id))];
    const replyProfileMap: Record<string, Profile> = {};

    if (replyUserIds.length > 0) {
      const { data: replyProfileData } = await supabase
        .from("profiles")
        .select("*")
        .in("id", replyUserIds);
      for (const replyProfile of (replyProfileData ?? []) as Profile[]) {
        replyProfileMap[replyProfile.id] = replyProfile;
      }
    }

    setProfile((authorResult.data as Profile | null) ?? null);
    setReplies(visibleReplies);
    setDiscussionSummary((summaryResult.data as DiscussionSummary | null) ?? null);
    setDiscussionTags(
      ((tagsResult.data ?? []) as Array<{ tag: string }>).map((row) => row.tag)
    );
    setDiscussionAttachments((attachmentResult.data ?? []) as DiscussionAttachment[]);
    setRelatedDiscussions(visibleRelated);
    setReplyProfiles(replyProfileMap);
    setCurrentUserId(viewer?.id ?? null);

    if (!viewer) {
      setAiEntitlement(null);
      setIsAdmin(false);
      setLoading(false);
      void trackDiscussionView(id);
      return;
    }

    const [savedResult, reportResult, viewerProfileResult, entitlementResult] = await Promise.all([
      supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", viewer.id)
        .eq("discussion_id", id)
        .maybeSingle(),
      supabase
        .from("reports")
        .select("id")
        .eq("reporter_id", viewer.id)
        .eq("discussion_id", id)
        .is("reply_id", null)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("is_admin, identity_verification_status")
        .eq("id", viewer.id)
        .single(),
      supabase
        .from("user_ai_entitlements")
        .select("tier, ai_assisted_enabled, monthly_summary_limit")
        .eq("user_id", viewer.id)
        .maybeSingle(),
    ]);

    const viewerProfile = viewerProfileResult.data as
      | { is_admin?: boolean | null; identity_verification_status?: string | null }
      | null;
    const viewerIsAdmin = Boolean(viewerProfile?.is_admin);
    const resolvedEntitlement: AiEntitlement = viewerIsAdmin
      ? { tier: "admin", ai_assisted_enabled: true, monthly_summary_limit: 999999 }
      : ((entitlementResult.data as AiEntitlement | null) ?? {
          tier: "free",
          ai_assisted_enabled: false,
          monthly_summary_limit: 0,
        });

    setIsAdmin(viewerIsAdmin);
    setViewerIdentityStatus(viewerProfile?.identity_verification_status ?? "unverified");
    setAiEntitlement(resolvedEntitlement);
    setIsSaved(Boolean(savedResult.data));
    setSavedBookmarkId((savedResult.data as { id?: string } | null)?.id ?? null);
    setReportedDiscussion(Boolean(reportResult.data));

    const replyIds = visibleReplies.map((reply) => reply.id);
    if (replyIds.length > 0) {
      const [reactionResult, replyReportResult] = await Promise.all([
        supabase
          .from("reply_reactions")
          .select("reply_id, user_id, reaction_type")
          .in("reply_id", replyIds),
        supabase
          .from("reports")
          .select("reply_id")
          .eq("reporter_id", viewer.id)
          .in("reply_id", replyIds),
      ]);

      const reactionCounts: Record<string, ReplyReactionCounts> = {};
      const viewerReactions: Record<string, ReplyReactionType[]> = {};
      for (const row of (reactionResult.data ?? []) as ReplyReactionRow[]) {
        const counts = reactionCounts[row.reply_id] ?? {};
        counts[row.reaction_type] = (counts[row.reaction_type] ?? 0) + 1;
        reactionCounts[row.reply_id] = counts;
        if (row.user_id === viewer.id) {
          viewerReactions[row.reply_id] = [
            ...(viewerReactions[row.reply_id] ?? []),
            row.reaction_type,
          ];
        }
      }
      setReplyReactionCounts(reactionCounts);
      setMyReplyReactions(viewerReactions);
      setReportedReplyIds(
        ((replyReportResult.data ?? []) as Array<{ reply_id: string | null }>)
          .map((row) => row.reply_id)
          .filter((replyId): replyId is string => Boolean(replyId))
      );
    }

    const subscriptionKey = getSubscriptionDisplayKey(resolvedEntitlement);
    if (["premium", "premium_plus", "admin"].includes(subscriptionKey)) {
      const token = await getAccessToken();
      if (token) {
        const response = await fetch("/api/stickies", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const result = (await response.json().catch(() => ({}))) as {
          stickies?: Array<{ source_key?: string }>;
        };
        setIsStickied(
          response.ok && Boolean(result.stickies?.some((sticky) => sticky.source_key === id))
        );
      }
    }

    setLoading(false);
    void trackDiscussionView(id);
    void loadAiOutputRatings(id);
  }, [getAccessToken, id, loadAiOutputRatings, trackDiscussionView]);

  useEffect(() => {
    void loadDiscussion();
  }, [loadDiscussion]);

  const subscriptionDisplayKey = getSubscriptionDisplayKey(aiEntitlement);
  const subscriptionDisplay = getSubscriptionDisplay(aiEntitlement);
  const canUsePremium = ["premium", "premium_plus", "admin"].includes(
    subscriptionDisplayKey
  );
  const canManageDiscussion = Boolean(
    discussion && currentUserId && (discussion.user_id === currentUserId || isAdmin)
  );
  const pinnedReply = discussion?.pinned_reply_id
    ? replies.find((reply) => reply.id === discussion.pinned_reply_id) ?? null
    : null;

  const sortedReplies = useMemo(() => {
    const visible = discussion?.pinned_reply_id
      ? replies.filter((reply) => reply.id !== discussion.pinned_reply_id)
      : [...replies];

    return visible.sort((a, b) => {
      if (replySort === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (replySort === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      const signalDifference =
        getReactionTotal(replyReactionCounts[b.id]) - getReactionTotal(replyReactionCounts[a.id]);
      if (signalDifference !== 0) return signalDifference;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [discussion?.pinned_reply_id, replies, replyReactionCounts, replySort]);

  function scrollToComposer(prefill?: string, reference?: Reply | null) {
    resetMessages();
    if (typeof prefill === "string") setReplyBody(prefill);
    if (reference !== undefined) setReferencedReply(reference);
    window.setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      composerRef.current?.querySelector("textarea")?.focus();
    }, 0);
  }

  function scrollToReplies() {
    repliesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleReply(event?: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLFormElement>) {
    event?.preventDefault();
    resetMessages();
    setSafetyWarning(null);
    if (workingAction === "reply") return;
    if (!replyBody.trim()) {
      setError("Reply cannot be empty.");
      return;
    }

    const token = await requireAccessToken();
    if (!token) return;
    setWorkingAction("reply");

    try {
      const response = await fetch("/api/replies/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          discussionId: id,
          body: normalizePublicText(replyBody),
          referencedReplyId: referencedReply?.id ?? undefined,
          pastedCharacterCount: pastedReplyCharacterCount,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        reply?: Reply;
      };

      if (!response.ok) {
        const warning = getSafetyWarningFromResult(result);
        if (warning) setSafetyWarning(warning);
        else setError(result.error ?? "Unable to post reply.");
        return;
      }

      if (result.reply) {
        setReplies((current) => [...current, result.reply as Reply]);
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", result.reply.user_id)
          .single();
        if (profileData) {
          setReplyProfiles((current) => ({
            ...current,
            [result.reply!.user_id]: profileData as Profile,
          }));
        }
      }

      setReplyBody("");
      setPastedReplyCharacterCount(0);
      setReferencedReply(null);
      setNotice("Reply posted.");
      broadcastDiscussionMetricsChanged(id);
      window.setTimeout(scrollToReplies, 100);
    } finally {
      setWorkingAction("");
    }
  }

  function handleReplyFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void handleReply(event);
  }

  function handleReplyPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pastedText = event.clipboardData.getData("text");
    setPastedReplyCharacterCount((current) => current + pastedText.length);
  }

  function startReplyEdit(reply: Reply) {
    resetMessages();
    setEditingReplyId(reply.id);
    setEditingReplyBody(reply.body);
  }

  async function handleUpdateReply(replyId: string) {
    resetMessages();
    setSafetyWarning(null);
    if (!editingReplyBody.trim()) {
      setError("Please enter a reply.");
      return;
    }
    const token = await requireAccessToken();
    if (!token) return;
    setWorkingAction(`edit:${replyId}`);

    try {
      const response = await fetch("/api/replies/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ replyId, body: normalizePublicText(editingReplyBody) }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        reply?: Reply;
      };
      if (!response.ok || !result.reply) {
        const warning = getSafetyWarningFromResult(result);
        if (warning) setSafetyWarning(warning);
        else setError(result.error ?? "Unable to update reply.");
        return;
      }
      const updated = result.reply;
      setReplies((current) =>
        current.map((reply) => (reply.id === replyId ? { ...reply, ...updated } : reply))
      );
      setEditingReplyId(null);
      setEditingReplyBody("");
      setNotice("Reply updated.");
    } finally {
      setWorkingAction("");
    }
  }

  async function handleDeleteReply(replyId: string) {
    resetMessages();
    if (!window.confirm("Delete this reply? This cannot be undone.")) return;
    const token = await requireAccessToken();
    if (!token) return;
    setWorkingAction(`delete:${replyId}`);
    try {
      const response = await fetch("/api/replies/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ replyId }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to delete reply.");
        return;
      }
      setReplies((current) => current.filter((reply) => reply.id !== replyId));
      setNotice("Reply deleted.");
      broadcastDiscussionMetricsChanged(id);
    } finally {
      setWorkingAction("");
    }
  }

  async function handleToggleReplyReaction(replyId: string, reactionType: ReplyReactionType) {
    if (reactionWorkingKey) return;
    const token = await requireAccessToken();
    if (!token) return;
    const workingKey = `${replyId}:${reactionType}`;
    setReactionWorkingKey(workingKey);

    try {
      const response = await fetch("/api/replies/react", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ replyId, reactionType }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        reacted?: boolean;
        counts?: ReplyReactionCounts;
      };
      if (!response.ok) {
        setError(result.error ?? "Unable to update reaction.");
        return;
      }
      setReplyReactionCounts((current) => ({
        ...current,
        [replyId]: result.counts ?? {},
      }));
      setMyReplyReactions((current) => {
        const currentTypes = new Set(current[replyId] ?? []);
        if (result.reacted) currentTypes.add(reactionType);
        else currentTypes.delete(reactionType);
        return { ...current, [replyId]: Array.from(currentTypes) };
      });
    } finally {
      setReactionWorkingKey("");
    }
  }

  async function updatePinnedReply(replyId: string, unpin = false) {
    resetMessages();
    const token = await requireAccessToken();
    if (!token || !discussion) return;
    setWorkingAction(`pin:${replyId}`);
    try {
      const response = await fetch("/api/discussions/pin-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ discussionId: discussion.id, replyId, unpin }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        discussion?: Partial<Discussion>;
      };
      if (!response.ok) {
        setError(result.error ?? "Unable to update pinned reply.");
        return;
      }
      setDiscussion((current) =>
        current
          ? {
              ...current,
              pinned_reply_id: result.discussion?.pinned_reply_id ?? null,
              pinned_at: result.discussion?.pinned_at ?? null,
              pinned_by: result.discussion?.pinned_by ?? null,
            }
          : current
      );
      setNotice(unpin ? "Reply unpinned." : "Reply pinned.");
    } finally {
      setWorkingAction("");
    }
  }

  async function updateDiscussionStatus(status: "open" | "resolved") {
    resetMessages();
    const token = await requireAccessToken();
    if (!token || !discussion) return;
    setWorkingAction("status");
    try {
      const response = await fetch("/api/discussions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ discussionId: discussion.id, status }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        discussion?: Partial<Discussion>;
      };
      if (!response.ok) {
        setError(result.error ?? "Unable to update discussion status.");
        return;
      }
      setDiscussion((current) =>
        current
          ? {
              ...current,
              discussion_status: result.discussion?.discussion_status ?? status,
              resolved_at: result.discussion?.resolved_at ?? null,
              resolved_by: result.discussion?.resolved_by ?? null,
            }
          : current
      );
      setNotice(status === "resolved" ? "Discussion marked resolved." : "Discussion reopened.");
    } finally {
      setWorkingAction("");
    }
  }

  async function loadBookmarkCollections() {
    const { data, error: collectionsError } = await supabase
      .from("bookmark_collections")
      .select("id, name")
      .order("created_at", { ascending: false });
    if (collectionsError) {
      setError("Unable to load saved folders.");
      return;
    }
    setBookmarkCollections((data ?? []) as BookmarkCollection[]);
  }

  async function openSavePanel() {
    resetMessages();
    if (!currentUserId) {
      router.push("/login");
      return;
    }
    if (!canUsePremium) {
      await handleSaveDiscussion(null);
      return;
    }
    await loadBookmarkCollections();
    setSelectedSaveCollectionId("unfiled");
    setShowSavePanel(true);
  }

  async function handleSaveDiscussion(collectionId: string | null) {
    resetMessages();
    const token = await requireAccessToken();
    if (!token) return false;
    setWorkingAction("save");
    try {
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ discussionId: id }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        bookmark?: { id?: string };
      };
      if (!response.ok) {
        setError(result.error ?? "Already saved or unable to save.");
        return false;
      }
      const bookmarkId = result.bookmark?.id ?? null;
      setIsSaved(true);
      setSavedBookmarkId(bookmarkId);
      broadcastDiscussionMetricsChanged(id);

      if (bookmarkId && collectionId) {
        const moveResponse = await fetch("/api/bookmarks/move", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ bookmarkId, collectionId }),
        });
        const moveResult = (await moveResponse.json().catch(() => ({}))) as { error?: string };
        if (!moveResponse.ok) {
          setError(
            moveResult.error ??
              "Discussion saved, but it could not be moved into the selected folder."
          );
          return false;
        }
      }

      setNotice(collectionId ? "Discussion saved to folder." : "Discussion saved.");
      setShowSavePanel(false);
      return true;
    } finally {
      setWorkingAction("");
    }
  }

  async function handleRemoveBookmark() {
    resetMessages();
    if (!savedBookmarkId) return;
    const token = await requireAccessToken();
    if (!token) return;
    setWorkingAction("save");
    try {
      const response = await fetch("/api/bookmarks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookmarkId: savedBookmarkId }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to remove saved discussion.");
        return;
      }
      setIsSaved(false);
      setSavedBookmarkId(null);
      setShowSavePanel(false);
      setNotice("Saved discussion removed.");
      broadcastDiscussionMetricsChanged(id);
    } finally {
      setWorkingAction("");
    }
  }

  async function handleAddToStickies() {
    resetMessages();
    const token = await requireAccessToken();
    if (!token) return;
    setWorkingAction("sticky");
    try {
      const response = await fetch("/api/stickies", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ discussionId: id }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to add to Stickies.");
        return;
      }
      setIsStickied(true);
      setNotice("Added to Stickies.");
    } finally {
      setWorkingAction("");
    }
  }

  async function submitReport() {
    resetMessages();
    if (!reportTarget) return;
    const token = await requireAccessToken();
    if (!token) return;
    setWorkingAction("report");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(
          reportTarget.type === "discussion"
            ? { targetType: "discussion", discussionId: id, reason: reportReason }
            : {
                targetType: "reply",
                discussionId: id,
                replyId: reportTarget.replyId,
                reason: reportReason,
              }
        ),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok && response.status !== 409) {
        setError(result.error ?? "Unable to submit report.");
        return;
      }
      if (reportTarget.type === "discussion") setReportedDiscussion(true);
      else {
        setReportedReplyIds((current) =>
          current.includes(reportTarget.replyId) ? current : [...current, reportTarget.replyId]
        );
      }
      setNotice(reportTarget.type === "discussion" ? "Discussion reported." : "Reply reported.");
      setReportTarget(null);
    } finally {
      setWorkingAction("");
    }
  }

  async function runAiTool(tool: AiToolKey) {
    resetMessages();
    setActiveAiTool(tool);
    if (!canUsePremium) return;
    const token = await requireAccessToken();
    if (!token || !discussion || aiWorkingKey) return;
    setAiWorkingKey(tool);

    try {
      if (tool === "summary") {
        const response = await fetch("/api/discussions/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ discussionId: discussion.id }),
        });
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
          summary?: DiscussionSummary;
          cached?: boolean;
        };
        if (!response.ok) {
          setError(result.error ?? "Unable to generate summary.");
          return;
        }
        setDiscussionSummary(result.summary ?? null);
        setNotice(result.cached ? "Showing cached overview." : "Overview generated.");
        return;
      }

      const config = AI_ENDPOINTS[tool];
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ discussionId: discussion.id }),
      });
      const result = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
        error?: string;
        cached?: boolean;
      };
      if (!response.ok) {
        setError(result.error ?? config.error);
        return;
      }
      const output = typeof result[config.resultKey] === "string" ? String(result[config.resultKey]) : "";
      setAiResults((current) => ({ ...current, [tool]: output }));
      setNotice(result.cached ? "Showing cached analysis." : "Analysis generated.");
    } finally {
      setAiWorkingKey("");
    }
  }

  async function generateReplySuggestions() {
    resetMessages();
    if (!canUsePremium) return;
    const token = await requireAccessToken();
    if (!token || !discussion || aiWorkingKey) return;
    setAiWorkingKey("replySuggestions");
    try {
      const response = await fetch("/api/discussions/reply-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ discussionId: discussion.id }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        replySuggestions?: string;
      };
      if (!response.ok) {
        setError(result.error ?? "Unable to generate reply suggestions.");
        return;
      }
      setReplySuggestions(result.replySuggestions ?? "");
      setNotice("Reply targets generated. Use them as prompts for your own thinking.");
    } finally {
      setAiWorkingKey("");
    }
  }

  async function rateAiOutput(featureKey: string, rating: AiOutputRatingValue | null) {
    if (!discussion) return;
    const token = await requireAccessToken();
    if (!token) return;
    setRatingWorkingKey(featureKey);
    try {
      const response = await fetch("/api/ai/output-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ discussionId: discussion.id, featureKey, rating }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        rating?: AiOutputRatingValue | null;
      };
      if (!response.ok) return;
      setAiOutputRatings((current) => {
        const next = { ...current };
        if (result.rating) next[featureKey] = result.rating;
        else delete next[featureKey];
        return next;
      });
    } finally {
      setRatingWorkingKey("");
    }
  }

  async function shareDiscussion() {
    if (!discussion || typeof window === "undefined") return;
    const shareData = {
      title: discussion.title,
      text: `Join this discussion on Loombus: ${discussion.title}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        setNotice("Discussion link copied.");
      }
    } catch {
      // A cancelled native share is not an error.
    }
  }

  function selectAiTool(tool: AiToolKey) {
    setActiveAiTool(tool);
    const hasOutput =
      tool === "summary" ? Boolean(discussionSummary?.summary) : Boolean(aiResults[tool]);
    if (canUsePremium && !hasOutput && !aiWorkingKey) void runAiTool(tool);
  }

  return {
    id,
    composerRef,
    repliesRef,
    discussion,
    profile,
    replies,
    relatedDiscussions,
    discussionTags,
    discussionAttachments,
    replyProfiles,
    loading,
    currentUserId,
    isAdmin,
    viewerIdentityStatus,
    aiEntitlement,
    subscriptionDisplay,
    subscriptionDisplayKey,
    canUsePremium,
    canManageDiscussion,
    pinnedReply,
    sortedReplies,
    replyBody,
    setReplyBody,
    pastedReplyCharacterCount,
    referencedReply,
    setReferencedReply,
    editingReplyId,
    setEditingReplyId,
    editingReplyBody,
    setEditingReplyBody,
    replySort,
    setReplySort,
    replyReactionCounts,
    myReplyReactions,
    isSaved,
    savedBookmarkId,
    bookmarkCollections,
    selectedSaveCollectionId,
    setSelectedSaveCollectionId,
    showSavePanel,
    setShowSavePanel,
    isStickied,
    reportedDiscussion,
    reportedReplyIds,
    reportTarget,
    setReportTarget,
    reportReason,
    setReportReason,
    discussionSummary,
    activeAiTool,
    aiResults,
    aiOutputRatings,
    replySuggestions,
    workingAction,
    reactionWorkingKey,
    aiWorkingKey,
    ratingWorkingKey,
    notice,
    error,
    safetyWarning,
    setSafetyWarning,
    resetMessages,
    scrollToComposer,
    scrollToReplies,
    handleReply,
    handleReplyFormKeyDown,
    handleReplyPaste,
    startReplyEdit,
    handleUpdateReply,
    handleDeleteReply,
    handleToggleReplyReaction,
    updatePinnedReply,
    updateDiscussionStatus,
    openSavePanel,
    handleSaveDiscussion,
    handleRemoveBookmark,
    handleAddToStickies,
    submitReport,
    runAiTool,
    selectAiTool,
    generateReplySuggestions,
    rateAiOutput,
    shareDiscussion,
  };
}
