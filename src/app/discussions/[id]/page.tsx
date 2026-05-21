"use client";

import Link from "next/link";
import { type FormEvent, type KeyboardEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { DEFAULT_REPORT_REASON, REPORT_REASONS, type ReportReason } from "@/lib/report-reasons";
import { ProfileAvatar } from "@/components/profile-avatar";

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Reply = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type DiscussionSummary = {
  id: string;
  discussion_id: string;
  summary: string;
  model_name: string | null;
  source_reply_count: number;
  generated_at: string;
};

type AiEntitlement = {
  tier: string;
  ai_assisted_enabled: boolean;
  monthly_summary_limit: number;
};

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[a-zA-Z0-9_]{2,30})/g);

  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^@([a-zA-Z0-9_]{2,30})$/);

        if (!match) {
          return <span key={`${part}-${index}`}>{part}</span>;
        }

        const username = match[1].toLowerCase();

        return (
          <Link
            key={`${part}-${index}`}
            href={`/u/${username}`}
            className="font-medium text-white underline decoration-zinc-600 underline-offset-4 transition hover:decoration-white"
          >
            @{username}
          </Link>
        );
      })}
    </>
  );
}

function ProfileName({
  profile,
  fallback = "Loombus member",
}: {
  profile?: Profile | null;
  fallback?: string;
}) {
  const label =
    profile?.full_name || (profile?.username ? `@${profile.username}` : fallback);

  if (!profile?.username) {
    return <>{label}</>;
  }

  return (
    <Link
      href={`/u/${profile.username}`}
      className="text-zinc-400 transition hover:text-white"
    >
      {label}
    </Link>
  );
}

export default function DiscussionPage() {
  const params = useParams();
  const id = params.id as string;

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyProfiles, setReplyProfiles] = useState<Record<string, Profile>>({});
  const [replyBody, setReplyBody] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);
  const [reportingReplyId, setReportingReplyId] = useState<string | null>(null);
  const [reportedDiscussion, setReportedDiscussion] = useState(false);
  const [reportedReplyIds, setReportedReplyIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [bookmarkMessage, setBookmarkMessage] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [savedBookmarkId, setSavedBookmarkId] = useState<string | null>(null);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportReason, setReportReason] = useState(DEFAULT_REPORT_REASON);
  const [discussionSummary, setDiscussionSummary] = useState<DiscussionSummary | null>(null);
  const [summaryMessage, setSummaryMessage] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [keyTakeaways, setKeyTakeaways] = useState("");
  const [takeawaysMessage, setTakeawaysMessage] = useState("");
  const [generatingTakeaways, setGeneratingTakeaways] = useState(false);
  const [whatChanged, setWhatChanged] = useState("");
  const [whatChangedMessage, setWhatChangedMessage] = useState("");
  const [generatingWhatChanged, setGeneratingWhatChanged] = useState(false);
  const [disagreementMap, setDisagreementMap] = useState("");
  const [disagreementMessage, setDisagreementMessage] = useState("");
  const [generatingDisagreement, setGeneratingDisagreement] = useState(false);
  const [aiEntitlement, setAiEntitlement] = useState<AiEntitlement | null>(null);
  const [monthlySummaryUsage, setMonthlySummaryUsage] = useState(0);
  const [monthlyTakeawaysUsage, setMonthlyTakeawaysUsage] = useState(0);
  const [monthlyWhatChangedUsage, setMonthlyWhatChangedUsage] = useState(0);
  const [monthlyDisagreementUsage, setMonthlyDisagreementUsage] = useState(0);
  const [openPremiumAiTool, setOpenPremiumAiTool] = useState("whatChanged");

  useEffect(() => {
    async function loadDiscussion() {
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

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", discussionData.user_id)
        .single();

      const { data: repliesData } = await supabase
        .from("replies")
        .select("*")
        .eq("discussion_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      const { data: summaryData } = await supabase
        .from("discussion_summaries")
        .select("id, discussion_id, summary, model_name, source_reply_count, generated_at")
        .eq("discussion_id", id)
        .maybeSingle();

      const { data: viewerData } = await supabase.auth.getUser();
      const hiddenProfileIds = new Set<string>();

      if (viewerData.user) {
        const { data: blockRows } = await supabase
          .from("user_blocks")
          .select("blocker_id, blocked_id")
          .or(`blocker_id.eq.${viewerData.user.id},blocked_id.eq.${viewerData.user.id}`);

        for (const block of (blockRows ?? []) as BlockRow[]) {
          hiddenProfileIds.add(
            block.blocker_id === viewerData.user.id ? block.blocked_id : block.blocker_id
          );
        }
      }

      const visibleReplies = (repliesData ?? []).filter(
        (reply) => !hiddenProfileIds.has(reply.user_id)
      );

      const replyUserIds = [...new Set(visibleReplies.map((reply) => reply.user_id))];

      const replyProfileMap: Record<string, Profile> = {};

      if (replyUserIds.length > 0) {
        const { data: replyProfileData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", replyUserIds);

        for (const replyProfile of replyProfileData ?? []) {
          replyProfileMap[replyProfile.id] = replyProfile;
        }
      }

      setCurrentUserId(viewerData.user?.id ?? null);

      await supabase.from("discussion_views").insert({
        discussion_id: id,
        viewer_id: viewerData.user?.id ?? null,
      });

      if (viewerData.user) {
        const { data: savedData } = await supabase
          .from("bookmarks")
          .select("id")
          .eq("user_id", viewerData.user.id)
          .eq("discussion_id", id)
          .maybeSingle();

        setIsSaved(Boolean(savedData));
        setSavedBookmarkId(savedData?.id ?? null);

        const { data: existingDiscussionReport } = await supabase
          .from("reports")
          .select("id")
          .eq("reporter_id", viewerData.user.id)
          .eq("discussion_id", id)
          .is("reply_id", null)
          .maybeSingle();

        setReportedDiscussion(Boolean(existingDiscussionReport));

        const replyIds = visibleReplies.map((reply) => reply.id);

        if (replyIds.length > 0) {
          const { data: existingReplyReports } = await supabase
            .from("reports")
            .select("reply_id")
            .eq("reporter_id", viewerData.user.id)
            .in("reply_id", replyIds);

          setReportedReplyIds(
            (existingReplyReports ?? [])
              .map((report) => report.reply_id)
              .filter((replyId): replyId is string => Boolean(replyId))
          );
        }

        const { data: viewerProfile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", viewerData.user.id)
          .single();

        const viewerIsAdmin = Boolean(viewerProfile?.is_admin);
        setIsAdmin(viewerIsAdmin);

        const { data: entitlementData } = await supabase
          .from("user_ai_entitlements")
          .select("tier, ai_assisted_enabled, monthly_summary_limit")
          .eq("user_id", viewerData.user.id)
          .maybeSingle();

        const resolvedEntitlement = viewerIsAdmin
          ? {
              tier: "admin",
              ai_assisted_enabled: true,
              monthly_summary_limit: 999999,
            }
          : entitlementData ?? {
              tier: "free",
              ai_assisted_enabled: false,
              monthly_summary_limit: 0,
            };

        setAiEntitlement(resolvedEntitlement);

        if (!viewerIsAdmin && resolvedEntitlement.ai_assisted_enabled) {
          const now = new Date();
          const monthStart = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
          ).toISOString();

          const { count: monthlyUsageCount } = await supabase
            .from("ai_usage_events")
            .select("*", { count: "exact", head: true })
            .eq("user_id", viewerData.user.id)
            .eq("feature_key", "thread_summary")
            .eq("cached", false)
            .eq("success", true)
            .gte("created_at", monthStart);

          const { count: monthlyTakeawaysCount } = await supabase
            .from("ai_usage_events")
            .select("*", { count: "exact", head: true })
            .eq("user_id", viewerData.user.id)
            .eq("feature_key", "key_takeaways")
            .eq("cached", false)
            .eq("success", true)
            .gte("created_at", monthStart);

          const { count: monthlyWhatChangedCount } = await supabase
            .from("ai_usage_events")
            .select("*", { count: "exact", head: true })
            .eq("user_id", viewerData.user.id)
            .eq("feature_key", "what_changed")
            .eq("cached", false)
            .eq("success", true)
            .gte("created_at", monthStart);

          const { count: monthlyDisagreementCount } = await supabase
            .from("ai_usage_events")
            .select("*", { count: "exact", head: true })
            .eq("user_id", viewerData.user.id)
            .eq("feature_key", "disagreement_map")
            .eq("cached", false)
            .eq("success", true)
            .gte("created_at", monthStart);

          setMonthlySummaryUsage(monthlyUsageCount ?? 0);
          setMonthlyTakeawaysUsage(monthlyTakeawaysCount ?? 0);
          setMonthlyWhatChangedUsage(monthlyWhatChangedCount ?? 0);
          setMonthlyDisagreementUsage(monthlyDisagreementCount ?? 0);
        }
      }

      setDiscussion(discussionData);
      setProfile(profileData ?? null);
      setDiscussionSummary(summaryData ?? null);
      setReplies(visibleReplies);
      setReplyProfiles(replyProfileMap);
      setLoading(false);
    }

    loadDiscussion();
  }, [id]);

  async function handleReply(
    event?: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLFormElement>
  ) {
    event?.preventDefault();

    setMessage("");

    if (postingReply) {
      return;
    }

    if (!replyBody.trim()) {
      setMessage("Reply cannot be empty.");
      return;
    }

    setPostingReply(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/replies/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          discussionId: id,
          body: replyBody,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to post reply.");
        return;
      }

      const newReply = result.reply as Reply | undefined;

      if (newReply) {
        setReplies((current) => [...current, newReply]);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", newReply.user_id)
          .single();

        if (profileData) {
          setReplyProfiles((current) => ({
            ...current,
            [newReply.user_id]: profileData,
          }));
        }
      }

      setReplyBody("");
      setMessage("Reply posted.");
    } finally {
      setPostingReply(false);
    }
  }

  function handleReplyFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      handleReply(event);
    }
  }

  async function handleGenerateSummary() {
    setSummaryMessage("");

    if (generatingSummary) {
      return;
    }

    setGeneratingSummary(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/discussions/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          discussionId: id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setSummaryMessage(result.error ?? "Unable to generate summary.");
        return;
      }

      setDiscussionSummary(result.summary ?? null);

      if (!result.cached && typeof result.monthlySummaryUsage === "number") {
        setMonthlySummaryUsage(result.monthlySummaryUsage);
      }

      setSummaryMessage(result.cached ? "Showing cached summary." : "Summary generated.");
    } finally {
      setGeneratingSummary(false);
    }
  }

  async function handleGenerateKeyTakeaways() {
    setTakeawaysMessage("");

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    if (!canUseAiSummary) {
      setTakeawaysMessage("Premium AI access is required for key takeaways.");
      return;
    }

    setGeneratingTakeaways(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      if (!discussion) {
        setTakeawaysMessage("Discussion is not loaded yet.");
        return;
      }

      const response = await fetch("/api/discussions/key-takeaways", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          discussionId: discussion.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setTakeawaysMessage(result.error ?? "Unable to generate key takeaways.");
        return;
      }

      setKeyTakeaways(result.takeaways ?? "");

      if (typeof result.monthlyTakeawaysUsage === "number") {
        setMonthlyTakeawaysUsage(result.monthlyTakeawaysUsage);
      }

      setTakeawaysMessage(
        result.cached ? "Showing cached key takeaways." : "Key takeaways generated."
      );
    } finally {
      setGeneratingTakeaways(false);
    }
  }


  async function handleGenerateWhatChanged() {
    setWhatChangedMessage("");

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    if (!canUseAiSummary) {
      setWhatChangedMessage("Premium AI access is required for what-changed analysis.");
      return;
    }

    setGeneratingWhatChanged(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      if (!discussion) {
        setWhatChangedMessage("Discussion is not loaded yet.");
        return;
      }

      const response = await fetch("/api/discussions/what-changed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          discussionId: discussion.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setWhatChangedMessage(result.error ?? "Unable to generate what-changed analysis.");
        return;
      }

      setWhatChanged(result.whatChanged ?? "");

      if (typeof result.monthlyWhatChangedUsage === "number") {
        setMonthlyWhatChangedUsage(result.monthlyWhatChangedUsage);
      }

      setWhatChangedMessage(
        result.cached ? "Showing cached what-changed analysis." : "What-changed analysis generated."
      );
    } finally {
      setGeneratingWhatChanged(false);
    }
  }

  async function handleGenerateDisagreementMap() {
    setDisagreementMessage("");

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    if (!canUseAiSummary) {
      setDisagreementMessage("Premium AI access is required for disagreement mapping.");
      return;
    }

    setGeneratingDisagreement(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      if (!discussion) {
        setDisagreementMessage("Discussion is not loaded yet.");
        return;
      }

      const response = await fetch("/api/discussions/disagreement-map", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          discussionId: discussion.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setDisagreementMessage(result.error ?? "Unable to generate disagreement map.");
        return;
      }

      setDisagreementMap(result.disagreementMap ?? "");

      if (typeof result.monthlyDisagreementUsage === "number") {
        setMonthlyDisagreementUsage(result.monthlyDisagreementUsage);
      }

      setDisagreementMessage(
        result.cached ? "Showing cached disagreement map." : "Disagreement map generated."
      );
    } finally {
      setGeneratingDisagreement(false);
    }
  }

  async function handleDeleteReply(replyId: string) {
    setMessage("");

    if (deletingReplyId) {
      return;
    }

    setDeletingReplyId(replyId);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/replies/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          replyId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to delete reply.");
        return;
      }

      setReplies((current) =>
        current.filter((reply) => reply.id !== replyId)
      );
      setMessage("Reply deleted.");
    } finally {
      setDeletingReplyId(null);
    }
  }

  async function handleBookmark() {
    setBookmarkMessage("");

    if (savingBookmark) {
      return;
    }

    setSavingBookmark(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: bookmark, error } = await supabase
        .from("bookmarks")
        .insert({
          user_id: userData.user.id,
          discussion_id: id,
        })
        .select("id")
        .single();

      if (error) {
        setBookmarkMessage("Already saved or unable to save.");
        return;
      }

      setIsSaved(true);
      setSavedBookmarkId(bookmark?.id ?? null);
      setBookmarkMessage("Discussion saved.");
    } finally {
      setSavingBookmark(false);
    }
  }

  async function handleRemoveBookmark() {
    setBookmarkMessage("");

    if (savingBookmark || !savedBookmarkId) {
      return;
    }

    setSavingBookmark(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("id", savedBookmarkId)
        .eq("user_id", userData.user.id);

      if (error) {
        setBookmarkMessage("Unable to remove saved discussion.");
        return;
      }

      setIsSaved(false);
      setSavedBookmarkId(null);
      setBookmarkMessage("Saved discussion removed.");
    } finally {
      setSavingBookmark(false);
    }
  }

  async function handleReport() {
    setReportMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { data: existingReport } = await supabase
      .from("reports")
      .select("id")
      .eq("reporter_id", userData.user.id)
      .eq("discussion_id", id)
      .is("reply_id", null)
      .maybeSingle();

    if (existingReport) {
      setReportedDiscussion(true);
      setReportMessage("You already reported this discussion.");
      return;
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: userData.user.id,
      discussion_id: id,
      reason: reportReason,
    });

    if (error) {
      if (error.code === "23505") {
        setReportedDiscussion(true);
        setReportMessage("You already reported this discussion.");
        return;
      }

      setReportMessage("Unable to submit report.");
      return;
    }

    setReportedDiscussion(true);
    setReportMessage("Discussion reported.");
  }

  async function handleReportReply(replyId: string) {
    setReportMessage("");

    if (reportingReplyId) {
      return;
    }

    setReportingReplyId(replyId);

    try {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: existingReport } = await supabase
        .from("reports")
        .select("id")
        .eq("reporter_id", userData.user.id)
        .eq("reply_id", replyId)
        .maybeSingle();

      if (existingReport) {
        setReportedReplyIds((current) =>
          current.includes(replyId) ? current : [...current, replyId]
        );
        setReportMessage("You already reported this reply.");
        return;
      }

      const { error } = await supabase.from("reports").insert({
        reporter_id: userData.user.id,
        discussion_id: id,
        reply_id: replyId,
        reason: reportReason,
      });

      if (error) {
        if (error.code === "23505") {
          setReportedReplyIds((current) =>
            current.includes(replyId) ? current : [...current, replyId]
          );
          setReportMessage("You already reported this reply.");
          return;
        }

        setReportMessage("Unable to report reply.");
        return;
      }

      setReportedReplyIds((current) =>
        current.includes(replyId) ? current : [...current, replyId]
      );
      setReportMessage("Reply reported.");
    } finally {
      setReportingReplyId(null);
    }
  }

  const canUseAiSummary =
    isAdmin ||
    Boolean(
      aiEntitlement?.ai_assisted_enabled &&
      ["premium", "admin"].includes(aiEntitlement.tier)
    );

  const monthlySummaryLimit = aiEntitlement?.monthly_summary_limit ?? 0;
  const monthlySummaryRemaining = Math.max(
    monthlySummaryLimit - monthlySummaryUsage,
    0
  );
  const monthlyTakeawaysRemaining = Math.max(
    monthlySummaryLimit - monthlyTakeawaysUsage,
    0
  );
  const monthlyWhatChangedRemaining = Math.max(
    monthlySummaryLimit - monthlyWhatChangedUsage,
    0
  );
  const monthlyDisagreementRemaining = Math.max(
    monthlySummaryLimit - monthlyDisagreementUsage,
    0
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl text-zinc-400">
          Loading discussion...
        </div>
      </main>
    );
  }

  if (!discussion) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-6 text-4xl font-semibold">
            Discussion not found.
          </h1>

          <Link href="/discussions" className="text-zinc-400 hover:text-white">
            ← Back to discussions
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/discussions"
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to discussions
        </Link>

        <p className="mb-4 text-sm text-zinc-500">
          {discussion.topic}
        </p>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          {discussion.title}
        </h1>

        <p className="mb-3 text-sm text-zinc-600">
          <span className="inline-flex items-center gap-3">
              <ProfileAvatar profile={profile} />
              <span>
                by <ProfileName profile={profile} />
              </span>
            </span>
        </p>

        <p className="mb-10 text-xl leading-relaxed text-zinc-300">
          {discussion.body}
        </p>

        <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
            Premium AI-Assisted Layer
          </p>

          <h2 className="text-3xl font-semibold tracking-tight">
            Premium AI Tools
          </h2>

          <p className="mt-3 max-w-2xl leading-relaxed text-zinc-500">
            Use AI to understand the strongest points, key shifts, and summary
            of this discussion without adding noise to the thread.
          </p>
        </div>

        <section className="mb-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                Thread Evolution
              </p>

              <h2 className="text-2xl font-medium">
                What Changed in This Thread
              </h2>
            </div>

            {openPremiumAiTool === "whatChanged" && currentUserId && canUseAiSummary && (
              <button
                type="button"
                onClick={handleGenerateWhatChanged}
                disabled={generatingWhatChanged}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
              >
                {generatingWhatChanged ? "Generating..." : "Generate What Changed"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              setOpenPremiumAiTool((current) =>
                current === "whatChanged" ? "" : "whatChanged"
              )
            }
            className="mb-4 rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white"
          >
            {openPremiumAiTool === "whatChanged" ? "Hide tool" : "Open tool"}
          </button>

          {openPremiumAiTool === "whatChanged" && (
            <>


          {whatChanged ? (
            <div className="whitespace-pre-wrap rounded-2xl border border-zinc-900 bg-black p-4 leading-relaxed text-zinc-300">
              {whatChanged}
            </div>
          ) : (
            <p className="leading-relaxed text-zinc-500">
              {!currentUserId
                ? "Log in to generate what changed in this thread."
                : canUseAiSummary
                  ? "Generate a concise view of how replies changed or expanded the original discussion."
                  : "What-changed analysis is available with the Premium AI-Assisted Layer."}
            </p>
          )}

          {currentUserId && canUseAiSummary && (
            <div className="mt-5 rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-500">
              {isAdmin ? (
                <p>
                  Admin AI access: unlimited what-changed analyses.
                </p>
              ) : (
                <p>
                  Premium AI what-changed usage: {monthlyWhatChangedUsage} of {monthlySummaryLimit} used this month.
                  {" "}Remaining: {monthlyWhatChangedRemaining}.
                </p>
              )}
            </div>
          )}

          {whatChangedMessage && (
            <p className="mt-4 text-sm text-zinc-500">
              {whatChangedMessage}
            </p>
          )}
        
            </>
          )}
        </section>

        <section className="mb-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                Viewpoint Map
              </p>

              <h2 className="text-2xl font-medium">
                Disagreement Mapping
              </h2>
            </div>

            {openPremiumAiTool === "disagreementMap" && currentUserId && canUseAiSummary && (
              <button
                type="button"
                onClick={handleGenerateDisagreementMap}
                disabled={generatingDisagreement}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
              >
                {generatingDisagreement ? "Generating..." : "Generate Disagreement Map"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              setOpenPremiumAiTool((current) =>
                current === "disagreementMap" ? "" : "disagreementMap"
              )
            }
            className="mb-4 rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white"
          >
            {openPremiumAiTool === "disagreementMap" ? "Hide tool" : "Open tool"}
          </button>

          {openPremiumAiTool === "disagreementMap" && (
            <>


          {disagreementMap ? (
            <div className="whitespace-pre-wrap rounded-2xl border border-zinc-900 bg-black p-4 leading-relaxed text-zinc-300">
              {disagreementMap}
            </div>
          ) : (
            <p className="leading-relaxed text-zinc-500">
              {!currentUserId
                ? "Log in to generate a neutral disagreement map for this discussion."
                : canUseAiSummary
                  ? "Map real disagreement, different assumptions, and unresolved questions without picking a winner."
                  : "Disagreement mapping is available with the Premium AI-Assisted Layer."}
            </p>
          )}

          {currentUserId && canUseAiSummary && (
            <div className="mt-5 rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-500">
              {isAdmin ? (
                <p>
                  Admin AI access: unlimited disagreement maps.
                </p>
              ) : (
                <p>
                  Premium AI disagreement map usage: {monthlyDisagreementUsage} of {monthlySummaryLimit} used this month.
                  {" "}Remaining: {monthlyDisagreementRemaining}.
                </p>
              )}
            </div>
          )}

          {disagreementMessage && (
            <p className="mt-4 text-sm text-zinc-500">
              {disagreementMessage}
            </p>
          )}
        
            </>
          )}
        </section>

        <section className="mb-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                High-Signal Takeaways
              </p>

              <h2 className="text-2xl font-medium">
                Key Takeaways
              </h2>
            </div>

            {openPremiumAiTool === "keyTakeaways" && currentUserId && canUseAiSummary && (
              <button
                type="button"
                onClick={handleGenerateKeyTakeaways}
                disabled={generatingTakeaways}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
              >
                {generatingTakeaways ? "Generating..." : "Generate Key Takeaways"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              setOpenPremiumAiTool((current) =>
                current === "keyTakeaways" ? "" : "keyTakeaways"
              )
            }
            className="mb-4 rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white"
          >
            {openPremiumAiTool === "keyTakeaways" ? "Hide tool" : "Open tool"}
          </button>

          {openPremiumAiTool === "keyTakeaways" && (
            <>


          {keyTakeaways ? (
            <div className="whitespace-pre-wrap rounded-2xl border border-zinc-900 bg-black p-4 leading-relaxed text-zinc-300">
              {keyTakeaways}
            </div>
          ) : (
            <p className="leading-relaxed text-zinc-500">
              {!currentUserId
                ? "Log in to generate AI-assisted key takeaways for this discussion."
                : canUseAiSummary
                  ? "Generate concise key takeaways from the discussion and visible replies."
                  : "AI-assisted key takeaways are available with the Premium AI-Assisted Layer."}
            </p>
          )}

          {currentUserId && canUseAiSummary && (
            <div className="mt-5 rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-500">
              {isAdmin ? (
                <p>
                  Admin AI access: unlimited key takeaways.
                </p>
              ) : (
                <p>
                  Premium AI key takeaways usage: {monthlyTakeawaysUsage} of {monthlySummaryLimit} used this month.
                  {" "}Remaining: {monthlyTakeawaysRemaining}.
                </p>
              )}
            </div>
          )}

          {takeawaysMessage && (
            <p className="mt-4 text-sm text-zinc-500">
              {takeawaysMessage}
            </p>
          )}
        
            </>
          )}
        </section>

        <section className="mb-12 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-600">
                AI-assisted
              </p>

              <h2 className="text-2xl font-medium">
                Discussion Summary
              </h2>
            </div>

            {!discussionSummary && currentUserId && canUseAiSummary && (
              <button
                type="button"
                onClick={handleGenerateSummary}
                disabled={generatingSummary}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
              >
                {generatingSummary ? "Generating..." : "Generate Summary"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              setOpenPremiumAiTool((current) =>
                current === "summary" ? "" : "summary"
              )
            }
            className="mb-4 rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white"
          >
            {openPremiumAiTool === "summary" ? "Hide tool" : "Open tool"}
          </button>

          {openPremiumAiTool === "summary" && (
            <>


          {discussionSummary ? (
            <>
              <div className="whitespace-pre-wrap leading-relaxed text-zinc-300">
                {discussionSummary.summary}
              </div>

              <p className="mt-4 text-xs text-zinc-600">
                Generated {new Date(discussionSummary.generated_at).toLocaleString()}
                {discussionSummary.model_name ? ` · ${discussionSummary.model_name}` : ""}
                {" "}· {discussionSummary.source_reply_count} replies counted
              </p>
            </>
          ) : (
            <p className="leading-relaxed text-zinc-500">
              {!currentUserId
                ? "Log in to generate an AI-assisted summary for this discussion."
                : canUseAiSummary
                  ? "No summary has been generated yet. Generate one to cache it for future readers."
                  : "AI-assisted summaries are available with the Premium AI-Assisted Layer."}
            </p>
          )}

          {openPremiumAiTool === "summary" && currentUserId && canUseAiSummary && (
            <div className="mt-5 rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-500">
              {isAdmin ? (
                <p>
                  Admin AI access: unlimited summaries.
                </p>
              ) : (
                <p>
                  Premium AI usage: {monthlySummaryUsage} of {monthlySummaryLimit} summaries used this month.
                  {" "}Remaining: {monthlySummaryRemaining}.
                </p>
              )}
            </div>
          )}

          {summaryMessage && (
            <p className="mt-4 text-sm text-zinc-500">
              {summaryMessage}
            </p>
          )}
        
            </>
          )}
        </section>

        <div className="mb-12 flex flex-wrap items-center gap-4">
          {isSaved ? (
            <button
              onClick={handleRemoveBookmark}
              disabled={savingBookmark}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
            >
              {savingBookmark ? "Removing..." : "Unsave"}
            </button>
          ) : (
            <button
              onClick={handleBookmark}
              disabled={savingBookmark}
              className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
            >
              {savingBookmark ? "Saving..." : "Save Discussion"}
            </button>
          )}

          <button
            onClick={handleReport}
            disabled={reportedDiscussion}
            className="rounded-full border border-red-900 px-5 py-3 text-sm text-red-400 transition hover:border-red-700 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
          >
            {reportedDiscussion ? "Reported" : "Report Discussion"}
          </button>

          {currentUserId && (
            <label className="flex min-w-64 flex-col text-xs text-zinc-500">
              <span className="mb-2">Report reason</span>

              <select
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value as ReportReason)}
                className="rounded-full border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
              >
                {REPORT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(bookmarkMessage || reportMessage) && (
            <p className="text-sm text-zinc-500">
              {bookmarkMessage || reportMessage}
            </p>
          )}
        </div>

        <div className="mb-16 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="mb-6 text-xl font-medium">
            AI Summary
          </h2>

          <p className="leading-relaxed text-zinc-400">
            AI summaries will be generated here later. For now, this section
            reserves space for the platform intelligence layer.
          </p>
        </div>

        <div>
          <h2 className="mb-8 text-2xl font-medium">
            Replies
          </h2>

          <form
            onSubmit={handleReply}
            onKeyDown={handleReplyFormKeyDown}
            className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
          >
            <label className="mb-3 block text-sm text-zinc-400">
              Add a thoughtful reply
            </label>

            <textarea
              rows={5}
              value={replyBody}
              required
              onChange={(e) => setReplyBody(e.target.value)}
              disabled={postingReply}
              placeholder="Contribute with clarity, context, and signal... Use @username to mention someone."
              className="mb-4 w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-600"
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={postingReply}
              className="rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
                {postingReply ? "Posting..." : "Post Reply"}
              </button>

              <p className="text-sm text-zinc-600">
                Press Cmd+Enter or Ctrl+Enter to reply.
              </p>
            </div>

            {message && <p className="mt-4 text-sm text-zinc-400">{message}</p>}
          </form>

          <div className="space-y-6">
            {replies.map((reply) => {
              const canDeleteReply =
                Boolean(currentUserId) &&
                (reply.user_id === currentUserId || isAdmin);

              const hasReportedReply = reportedReplyIds.includes(reply.id);

              const canReportReply =
                Boolean(currentUserId) && reply.user_id !== currentUserId;

              return (
                <div
                  key={reply.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-zinc-500">
                      <span className="inline-flex items-center gap-3">
                        <ProfileAvatar
                          profile={replyProfiles[reply.user_id]}
                          size="sm"
                        />
                        <ProfileName profile={replyProfiles[reply.user_id]} />
                      </span>
                    </p>

                    {canReportReply && (
                      <button
                        type="button"
                        onClick={() => handleReportReply(reply.id)}
                        disabled={reportingReplyId === reply.id || hasReportedReply}
                        className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {hasReportedReply
                          ? "Reported"
                          : reportingReplyId === reply.id
                            ? "Reporting..."
                            : "Report"}
                      </button>
                    )}

                    {canDeleteReply && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReply(reply.id)}
                        disabled={deletingReplyId === reply.id}
                        className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-red-900 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {deletingReplyId === reply.id ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </div>

                  <p className="whitespace-pre-wrap leading-relaxed text-zinc-300">
                    <MentionText text={reply.body} />
                  </p>
                </div>
              );
            })}

            {replies.length === 0 && (
              <p className="text-zinc-500">
                No replies yet. Be the first to contribute.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
