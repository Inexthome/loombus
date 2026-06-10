"use client";

import { normalizePublicText } from "@/lib/public-text";
import { SafetyWarningModal, getSafetyWarningFromResult, type SafetyWarningState } from "@/components/safety-warning-modal";

import Link from "next/link";
import { type ClipboardEvent, type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { REALITY_LENSES, normalizeRealityLens } from "@/lib/reality-lenses";
import { PURPOSE_LANES, normalizePurposeLane } from "@/lib/purpose-lanes";

type Profile = {
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_admin?: boolean | null;
  identity_verification_status?: string | null;
};

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

type DiscussionDraft = {
  id: string;
  title: string;
  topic: string;
  reality_lens: string | null;
  purpose_lane: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

type DiscussionMode = "open_discussion" | "debate" | "research_question" | "problem_solving";

type DiscussionMetadata = Record<string, string>;

type MemoryDiscussion = {
  id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
};

type EditableDiscussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  reality_lens: string | null;
  purpose_lane: string | null;
  discussion_type?: DiscussionMode | null;
  discussion_metadata?: DiscussionMetadata | null;
  body: string;
  created_at: string;
  updated_at: string | null;
  edited_at: string | null;
  edit_count: number | null;
};

const DISCUSSION_MODES: Array<{
  value: DiscussionMode;
  label: string;
  description: string;
}> = [
  {
    value: "open_discussion",
    label: "Open Discussion",
    description: "A simple question, topic, or idea for thoughtful replies.",
  },
  {
    value: "debate",
    label: "Debate",
    description: "Frame a claim, evidence, and a question for opposing views.",
  },
  {
    value: "research_question",
    label: "Research Question",
    description: "Explore a question with context, sources, and unresolved points.",
  },
  {
    value: "problem_solving",
    label: "Problem Solving",
    description: "Explain a problem, what you tried, constraints, and the desired outcome.",
  },
];

const STANDARD_DISCUSSION_MAX_LENGTH = 5000;
const LONG_DISCUSSION_MAX_LENGTH = 12000;
const ATTACHMENT_BUCKET = "discussion-attachments";
const MAX_ATTACHMENT_FILES = 3;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const SIMILAR_DISCUSSION_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "also",
  "because",
  "before",
  "being",
  "between",
  "could",
  "discussion",
  "from",
  "have",
  "into",
  "more",
  "should",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "what",
  "when",
  "where",
  "which",
  "while",
  "will",
  "with",
  "would",
]);

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function getDiscussionMemoryTerms(value: string) {
  return [
    ...new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(
          (term) =>
            term.length >= 3 &&
            !SIMILAR_DISCUSSION_STOP_WORDS.has(term)
        )
    ),
  ].slice(0, 18);
}

function getSimilarDiscussionScore({
  candidate,
  title,
  body,
  topic,
}: {
  candidate: MemoryDiscussion;
  title: string;
  body: string;
  topic: string;
}) {
  const titleTerms = getDiscussionMemoryTerms(title);
  const bodyTerms = getDiscussionMemoryTerms(body).slice(0, 10);
  const allTerms = [...new Set([...titleTerms, ...bodyTerms])];

  if (allTerms.length === 0) {
    return 0;
  }

  const candidateText = `${candidate.title} ${candidate.body} ${candidate.topic}`.toLowerCase();
  let score = 0;

  for (const term of titleTerms) {
    if (candidate.title.toLowerCase().includes(term)) {
      score += 4;
    } else if (candidateText.includes(term)) {
      score += 2;
    }
  }

  for (const term of bodyTerms) {
    if (candidateText.includes(term)) {
      score += 1;
    }
  }

  if (topic && candidate.topic === topic) {
    score += 3;
  }

  return score;
}

function getSimilarDiscussions({
  discussions,
  title,
  body,
  topic,
}: {
  discussions: MemoryDiscussion[];
  title: string;
  body: string;
  topic: string;
}) {
  if (title.trim().length < 15) {
    return [];
  }

  return discussions
    .map((discussion) => ({
      discussion,
      score: getSimilarDiscussionScore({
        candidate: discussion,
        title,
        body,
        topic,
      }),
    }))
    .filter((item) => item.score >= 3)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (
        new Date(b.discussion.created_at).getTime() -
        new Date(a.discussion.created_at).getTime()
      );
    })
    .slice(0, 3)
    .map((item) => item.discussion);
}

function getMissingProfileFields(profile: Profile | null) {
  const missing = [];

  if (!profile?.username?.trim()) {
    missing.push("username");
  }

  if (!profile?.full_name?.trim()) {
    missing.push("full name");
  }

  if (!profile?.bio?.trim()) {
    missing.push("bio");
  }

  if (!profile?.avatar_url?.trim()) {
    missing.push("profile image");
  }

  return missing;
}

function hasPremiumAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) {
    return true;
  }

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium"
  );
}

function hasLongPostAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) {
    return true;
  }

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) > 50
  );
}

function getEditWindowLabel(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) {
    return "Full edit access: no normal edit-window limit";
  }

  if (hasPremiumAccess(entitlement, false)) {
    return "Premium edit window: 7 days after publishing";
  }

  return "Free edit window: 15 minutes after publishing";
}

function getQueryParam(name: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get(name);
}

function getTagInputItems(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim().replace(/^#+/, "").replace(/\s+/g, " "))
        .filter(Boolean)
        .map((tag) => tag.slice(0, 40))
    ),
  ].slice(0, 5);
}

function getTagInputHelper(value: string) {
  const tags = getTagInputItems(value);

  if (tags.length === 0) {
    return "Optional. Add up to 5 tags separated by commas.";
  }

  return `${tags.length}/5 tags: ${tags.join(", ")}`;
}

function formatAttachmentFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getAttachmentKind(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType === "application/pdf") {
    return "pdf";
  }

  return null;
}

function getSafeAttachmentFileName(fileName: string) {
  return fileName.trim().replace(/[\\/]/g, "-").slice(0, 120);
}

function getRecommendedDiscussionTopic(title: string, body: string) {
  const text = `${title} ${body}`.toLowerCase();

  if (!text.trim()) {
    return "";
  }

  const topicSignals: Array<{
    topic: (typeof DISCUSSION_TOPICS)[number];
    keywords: string[];
  }> = [
    {
      topic: "AI & Society",
      keywords: ["artificial intelligence", "chatgpt", "openai", "machine learning", "automation", "algorithm", "ai tool", "ai model"],
    },
    {
      topic: "Books & Writing",
      keywords: ["book", "author", "writing", "publishing", "manuscript", "reader", "novel"],
    },
    {
      topic: "Business",
      keywords: ["business", "company", "customer", "market", "strategy", "revenue", "startup"],
    },
    {
      topic: "Education",
      keywords: ["school", "student", "teacher", "classroom", "college", "university", "education"],
    },
    {
      topic: "Future of Work",
      keywords: ["future of work", "job", "career", "workplace", "hiring", "remote work", "labor"],
    },
    {
      topic: "Money & Finance",
      keywords: ["money", "finance", "investing", "stock", "crypto", "bank", "debt", "loan"],
    },
    {
      topic: "Law & Justice",
      keywords: ["law", "court", "justice", "legal", "policy", "rights", "crime"],
    },
    {
      topic: "Healthcare",
      keywords: ["health", "doctor", "hospital", "medical", "patient", "medicine", "healthcare"],
    },
    {
      topic: "Local Community",
      keywords: ["local", "community", "city", "neighborhood", "county", "school board"],
    },
    {
      topic: "Politics & Policy",
      keywords: ["politics", "election", "government", "policy", "congress", "president", "senate"],
    },
    {
      topic: "Science",
      keywords: ["science", "research", "physics", "biology", "chemistry", "experiment"],
    },
    {
      topic: "Technology",
      keywords: ["technology", "software", "app", "platform", "device", "data", "internet"],
    },
  ];

  return topicSignals.find((signal) =>
    signal.keywords.some((keyword) => text.includes(keyword))
  )?.topic ?? "";
}

function escapeLimitedHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function hasLimitedFormattingHtml(value: string) {
  return /<\/?(strong|b|em|i|br|p|div)\b/i.test(value);
}

function sanitizeLimitedDiscussionHtml(value: string) {
  const pattern = /<\/?(strong|b|em|i|br|p|div)\b[^>]*>/gi;
  let safe = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    safe += escapeLimitedHtml(value.slice(lastIndex, match.index));

    const rawTag = match[0].toLowerCase();
    const tagName = match[1].toLowerCase();
    const normalizedTag =
      tagName === "b" ? "strong" : tagName === "i" ? "em" : tagName;

    if (normalizedTag === "br") {
      safe += "<br>";
    } else if (rawTag.startsWith("</")) {
      safe += `</${normalizedTag}>`;
    } else {
      safe += `<${normalizedTag}>`;
    }

    lastIndex = pattern.lastIndex;
  }

  safe += escapeLimitedHtml(value.slice(lastIndex));

  return safe
    .replace(/<div><br><\/div>/gi, "<br>")
    .replace(/<p><br><\/p>/gi, "<br>");
}

function bodyValueToEditorHtml(value: string) {
  if (!value) {
    return "";
  }

  if (hasLimitedFormattingHtml(value)) {
    return sanitizeLimitedDiscussionHtml(value);
  }

  return escapeLimitedHtml(value).replace(/\n/g, "<br>");
}

function getPlainTextFromLimitedHtml(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

export default function CreatePage() {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState<string>("");
  const [topicManuallySelected, setTopicManuallySelected] = useState(false);
  const [realityLens, setRealityLens] = useState<string>("");
  const [purposeLane, setPurposeLane] = useState<string>("");
  const [discussionType, setDiscussionType] = useState<DiscussionMode>("open_discussion");
  const [modeClaim, setModeClaim] = useState("");
  const [modeSupportingArgument, setModeSupportingArgument] = useState("");
  const [modeEvidence, setModeEvidence] = useState("");
  const [modeOpposingQuestion, setModeOpposingQuestion] = useState("");
  const [modeResearchQuestion, setModeResearchQuestion] = useState("");
  const [modeBackground, setModeBackground] = useState("");
  const [modeSources, setModeSources] = useState("");
  const [modeOpenQuestions, setModeOpenQuestions] = useState("");
  const [modeProblem, setModeProblem] = useState("");
  const [modeTried, setModeTried] = useState("");
  const [modeConstraints, setModeConstraints] = useState("");
  const [modeDesiredOutcome, setModeDesiredOutcome] = useState("");
  const [body, setBody] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entitlement, setEntitlement] = useState<AiEntitlement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [memoryDiscussions, setMemoryDiscussions] = useState<MemoryDiscussion[]>([]);
  const [editingDiscussionId, setEditingDiscussionId] = useState<string | null>(null);
  const [editingDiscussionMeta, setEditingDiscussionMeta] =
    useState<EditableDiscussion | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [safetyWarning, setSafetyWarning] = useState<SafetyWarningState>(null);
  const [qualityCheck, setQualityCheck] = useState("");
  const [qualityCheckMessage, setQualityCheckMessage] = useState("");
  const [generatingQualityCheck, setGeneratingQualityCheck] = useState(false);
  const [clarityRewrite, setClarityRewrite] = useState("");
  const [rewriteMessage, setRewriteMessage] = useState("");
  const [generatingRewrite, setGeneratingRewrite] = useState(false);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [showAttachmentsPanel, setShowAttachmentsPanel] = useState(false);
  const [showWritingTools, setShowWritingTools] = useState(false);
  const [activeCreateMetadataTool, setActiveCreateMetadataTool] =
    useState<"none" | "topic" | "mode" | "other" | "reality" | "purpose" | "tags">("none");
  const [activeCreateTool, setActiveCreateTool] =
    useState<"none" | "attachments" | "quality" | "rewrite">("none");
  const [createSignalBarHidden, setCreateSignalBarHidden] = useState(false);
  const createSignalLastScrollRef = useRef(0);
  const bodyEditorRef = useRef<HTMLDivElement | null>(null);
  const bodyAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const isAdmin = Boolean(profile?.is_admin);
  const identityVerificationStatus = profile?.identity_verification_status ?? "unverified";
  const canCreateOrEditDiscussion = true;
  const canUseDrafts = hasPremiumAccess(entitlement, isAdmin);
  const canUseLongPosts = hasLongPostAccess(entitlement, isAdmin);
  const canUseQualityCheck = canUseLongPosts;
  const maxDiscussionLength = canUseLongPosts
    ? LONG_DISCUSSION_MAX_LENGTH
    : STANDARD_DISCUSSION_MAX_LENGTH;
  const bodyPlainText = useMemo(() => getPlainTextFromLimitedHtml(body), [body]);
  const bodyCharacterCount = bodyPlainText.length;
  const isBodyOverLimit = bodyCharacterCount > maxDiscussionLength;
  const tagInputHelper = getTagInputHelper(tagsInput);
  const isEditMode = Boolean(editingDiscussionId);
  const recommendedTopic = useMemo(() => {
    if (topic || topicManuallySelected) {
      return "";
    }

    return getRecommendedDiscussionTopic(title, body);
  }, [body, title, topic, topicManuallySelected]);

  const similarDiscussions = useMemo(
    () =>
      getSimilarDiscussions({
        discussions: memoryDiscussions,
        title,
        body: bodyPlainText,
        topic,
      }),
    [bodyPlainText, memoryDiscussions, title, topic]
  );

  useEffect(() => {
    let frameId = 0;

    function handleCreateSignalBarScroll() {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        const currentScrollY =
          window.scrollY ||
          document.documentElement.scrollTop ||
          document.body.scrollTop ||
          0;
        const lastScrollY = createSignalLastScrollRef.current;
        const delta = currentScrollY - lastScrollY;

        if (currentScrollY < 80) {
          setCreateSignalBarHidden(false);
        } else if (delta > 8 && currentScrollY > 160) {
          setCreateSignalBarHidden(true);
        } else if (delta < -8) {
          setCreateSignalBarHidden(false);
        }

        createSignalLastScrollRef.current = currentScrollY;
        frameId = 0;
      });
    }

    handleCreateSignalBarScroll();
    window.addEventListener("scroll", handleCreateSignalBarScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleCreateSignalBarScroll);

      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  useEffect(() => {
    async function loadProfileStatus() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setIsLoggedIn(false);
        setAuthChecked(true);
        return;
      }

      setIsLoggedIn(true);
      setCurrentUserId(userData.user.id);

      const { data: memoryDiscussionData } = await supabase
        .from("discussions")
        .select("id, title, topic, body, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      setMemoryDiscussions((memoryDiscussionData ?? []) as MemoryDiscussion[]);

      const requestedDraftId = getQueryParam("draft");
      const requestedEditId = getQueryParam("edit");

      const [{ data: profileData }, { data: entitlementData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, username, bio, avatar_url, is_admin, identity_verification_status")
          .eq("id", userData.user.id)
          .maybeSingle(),
        supabase
          .from("user_ai_entitlements")
          .select("tier, ai_assisted_enabled, monthly_summary_limit")
          .eq("user_id", userData.user.id)
          .maybeSingle(),
      ]);

      const resolvedProfile = profileData ?? null;

      setProfile(resolvedProfile);
      setEntitlement((entitlementData ?? null) as AiEntitlement);

      if (requestedEditId) {
        const { data: discussionData, error: discussionError } = await supabase
          .from("discussions")
          .select("id, user_id, title, topic, reality_lens, purpose_lane, discussion_type, discussion_metadata, body, created_at, updated_at, edited_at, edit_count")
          .eq("id", requestedEditId)
          .is("deleted_at", null)
          .maybeSingle();

        if (discussionError) {
          setMessage(`Unable to load discussion for editing: ${discussionError.message}`);
        }

        if (discussionData) {
          const discussion = discussionData as EditableDiscussion;
          const viewerIsAdmin = Boolean(resolvedProfile?.is_admin);

          if (discussion.user_id !== userData.user.id && !viewerIsAdmin) {
            setMessage("You do not have permission to edit this discussion.");
          } else {
            setEditingDiscussionId(discussion.id);
            setEditingDiscussionMeta(discussion);
            setTitle(discussion.title ?? "");

            const loadedTopic = DISCUSSION_TOPICS.includes(discussion.topic as typeof DISCUSSION_TOPICS[number])
              ? discussion.topic
              : "";

            setTopic(loadedTopic);
            setTopicManuallySelected(Boolean(loadedTopic));
            setRealityLens(normalizeRealityLens(discussion.reality_lens) ?? "");
            setPurposeLane(normalizePurposeLane(discussion.purpose_lane) ?? "");
            setDiscussionType(discussion.discussion_type ?? "open_discussion");

            const metadata = discussion.discussion_metadata ?? {};
            setModeClaim(metadata.claim ?? "");
            setModeSupportingArgument(metadata.supportingArgument ?? "");
            setModeEvidence(metadata.evidence ?? "");
            setModeOpposingQuestion(metadata.opposingQuestion ?? "");
            setModeResearchQuestion(metadata.researchQuestion ?? "");
            setModeBackground(metadata.background ?? "");
            setModeSources(metadata.sources ?? "");
            setModeOpenQuestions(metadata.openQuestions ?? "");
            setModeProblem(metadata.problem ?? "");
            setModeTried(metadata.tried ?? "");
            setModeConstraints(metadata.constraints ?? "");
            setModeDesiredOutcome(metadata.desiredOutcome ?? "");

            setBody(discussion.body ?? "");

            const { data: tagRows, error: tagError } = await supabase
              .from("discussion_tags")
              .select("tag")
              .eq("discussion_id", discussion.id)
              .order("tag", { ascending: true });

            if (tagError) {
              setMessage(`Discussion loaded, but tags could not load: ${tagError.message}`);
            } else {
              setTagsInput((tagRows ?? []).map((row: { tag: string }) => row.tag).join(", "));
              setMessage("Discussion loaded for editing.");
            }
          }
        }

        setAuthChecked(true);
        return;
      }

      if (requestedDraftId) {
        const { data: draftData, error: draftError } = await supabase
          .from("discussion_drafts")
          .select("id, title, topic, reality_lens, purpose_lane, body, created_at, updated_at")
          .eq("id", requestedDraftId)
          .eq("user_id", userData.user.id)
          .maybeSingle();

        if (draftError) {
          setMessage(`Unable to load draft: ${draftError.message}`);
        }

        if (draftData) {
          const draft = draftData as DiscussionDraft;
          setDraftId(draft.id);
          setTitle(draft.title ?? "");

          const loadedTopic = DISCUSSION_TOPICS.includes(draft.topic as typeof DISCUSSION_TOPICS[number])
            ? draft.topic
            : "";

          setTopic(loadedTopic);
          setTopicManuallySelected(Boolean(loadedTopic));
          setRealityLens(normalizeRealityLens(draft.reality_lens) ?? "");
          setPurposeLane(normalizePurposeLane(draft.purpose_lane) ?? "");
          setBody(draft.body ?? "");
          setTagsInput("");
          setDraftUpdatedAt(draft.updated_at);
          setMessage("Draft loaded.");
        }
      }

      setAuthChecked(true);
    }

    loadProfileStatus();
  }, []);

  const missingProfileFields = useMemo(
    () => getMissingProfileFields(profile),
    [profile]
  );

  const profileComplete = missingProfileFields.length === 0;

  async function saveDraft() {
    setMessage("");

    if (isEditMode) {
      setMessage("Published edits cannot be saved as drafts from this screen.");
      return;
    }

    if (!currentUserId || savingDraft) {
      return;
    }

    if (!canUseDrafts) {
      setMessage("Draft mode requires Premium access.");
      return;
    }

    if (!title.trim() && !bodyPlainText.trim()) {
      setMessage("Add a title or body before saving a draft.");
      return;
    }

    setSavingDraft(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setSavingDraft(false);
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/discussion-drafts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        draftId,
        title,
        topic,
        realityLens,
        purposeLane,
        body,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setSavingDraft(false);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to save draft.");
      return;
    }

    const savedDraft = result.draft as { id: string; updated_at: string };
    setDraftId(savedDraft.id);
    setDraftUpdatedAt(savedDraft.updated_at);

    if (!draftId && typeof window !== "undefined") {
      window.history.replaceState(null, "", `/create?draft=${savedDraft.id}`);
    }

    setMessage("Draft saved.");
  }

  async function runQualityCheck() {
    setQualityCheckMessage("");
    setQualityCheck("");

    if (generatingQualityCheck) {
      return;
    }

    if (!canUseQualityCheck) {
      setQualityCheckMessage("AI discussion quality check requires Premium Plus access.");
      return;
    }

    if (!title.trim()) {
      setQualityCheckMessage("Enter a title before running the quality check.");
      return;
    }

    if (!bodyPlainText.trim() || bodyPlainText.trim().length < 8) {
      setQualityCheckMessage("Add more discussion content before running the quality check.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    setGeneratingQualityCheck(true);

    try {
      const response = await fetch("/api/discussions/quality-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          title,
          topic,
          body: bodyPlainText,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setQualityCheckMessage(result.error ?? "Unable to run quality check.");
        return;
      }

      setQualityCheck(result.qualityCheck ?? "");
      setQualityCheckMessage("Quality check complete.");
    } finally {
      setGeneratingQualityCheck(false);
    }
  }

  async function runClarityRewrite() {
    setRewriteMessage("");
    setClarityRewrite("");

    if (generatingRewrite) {
      return;
    }

    if (!canUseQualityCheck) {
      setRewriteMessage("AI rewrite for clarity requires Premium Plus access.");
      return;
    }

    if (!title.trim()) {
      setRewriteMessage("Enter a title before running the rewrite.");
      return;
    }

    if (!bodyPlainText.trim() || bodyPlainText.trim().length < 8) {
      setRewriteMessage("Add more discussion content before running the rewrite.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    setGeneratingRewrite(true);

    try {
      const response = await fetch("/api/discussions/rewrite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          title,
          topic,
          body: bodyPlainText,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setRewriteMessage(result.error ?? "Unable to run clarity rewrite.");
        return;
      }

      setClarityRewrite(result.rewrite ?? "");
      setRewriteMessage("Rewrite generated. Review it before applying.");
    } finally {
      setGeneratingRewrite(false);
    }
  }

  function applyClarityRewrite() {
    if (!clarityRewrite.trim()) {
      return;
    }

    setBody(clarityRewrite);
    setRewriteMessage("Rewrite applied to editor. Review before publishing.");
  }

  function handleAttachmentSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    setAttachmentMessage("");

    if (selectedFiles.length === 0) {
      setAttachmentFiles([]);
      return;
    }

    if (selectedFiles.length > MAX_ATTACHMENT_FILES) {
      setAttachmentFiles([]);
      setAttachmentMessage("You can attach up to 3 files.");
      event.target.value = "";
      return;
    }

    const invalidFile = selectedFiles.find(
      (file) =>
        !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type) ||
        file.size <= 0 ||
        file.size > MAX_ATTACHMENT_SIZE_BYTES
    );

    if (invalidFile) {
      setAttachmentFiles([]);
      setAttachmentMessage("Attachments must be JPG, PNG, WebP, GIF, or PDF files up to 10 MB each.");
      event.target.value = "";
      return;
    }

    setAttachmentFiles(selectedFiles);
    setAttachmentMessage(`${selectedFiles.length} attachment${selectedFiles.length === 1 ? "" : "s"} ready.`);
  }

  function clearAttachments() {
    setAttachmentFiles([]);
    setAttachmentMessage("");
  }

  async function uploadDiscussionAttachments({
    discussionId,
    accessToken,
  }: {
    discussionId: string;
    accessToken: string;
  }) {
    if (!currentUserId || attachmentFiles.length === 0) {
      return true;
    }

    for (const [index, file] of attachmentFiles.entries()) {
      const extension = getSafeAttachmentFileName(file.name).split(".").pop() || "file";
      const storagePath = `${currentUserId}/${discussionId}/${crypto.randomUUID()}.${extension}`;
      const attachmentKind = getAttachmentKind(file.type);

      if (!attachmentKind) {
        setAttachmentMessage("Attachment type is not allowed.");
        return false;
      }

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        setAttachmentMessage(`Discussion was saved, but ${file.name} could not upload.`);
        return false;
      }

      const { data: publicUrlData } = supabase.storage
        .from(ATTACHMENT_BUCKET)
        .getPublicUrl(storagePath);

      const response = await fetch("/api/discussions/attachments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          discussionId,
          storagePath,
          publicUrl: publicUrlData.publicUrl,
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          sortOrder: index,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
        setAttachmentMessage(result.error ?? `Discussion was saved, but ${file.name} could not be attached.`);
        return false;
      }
    }

    return true;
  }


  function getDiscussionMetadata() {
    if (discussionType === "debate") {
      return {
        claim: modeClaim.trim(),
        supportingArgument: modeSupportingArgument.trim(),
        evidence: modeEvidence.trim(),
        opposingQuestion: modeOpposingQuestion.trim(),
      };
    }

    if (discussionType === "research_question") {
      return {
        researchQuestion: modeResearchQuestion.trim(),
        background: modeBackground.trim(),
        sources: modeSources.trim(),
        openQuestions: modeOpenQuestions.trim(),
      };
    }

    if (discussionType === "problem_solving") {
      return {
        problem: modeProblem.trim(),
        tried: modeTried.trim(),
        constraints: modeConstraints.trim(),
        desiredOutcome: modeDesiredOutcome.trim(),
      };
    }

    return {};
  }

  async function handleCreate(
    event?: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLFormElement>
  ) {
    event?.preventDefault();

    if (publishing) {
      return;
    }

    setPublishing(true);
    setMessage("");
    setSafetyWarning(null);

    if (!canCreateOrEditDiscussion) {
      setPublishing(false);
      setMessage("Verify your identity before publishing discussions.");
      return;
    }

    if (!title.trim()) {
      setMessage("Please enter a discussion title.");
      setPublishing(false);
      return;
    }

    if (!bodyPlainText.trim()) {
      setMessage("Please enter discussion content.");
      setPublishing(false);
      return;
    }

    if (bodyCharacterCount > maxDiscussionLength) {
      setMessage(`Discussion content is too long. Your current limit is ${maxDiscussionLength.toLocaleString()} characters.`);
      setPublishing(false);
      return;
    }

    if (!topic || !DISCUSSION_TOPICS.includes(topic as typeof DISCUSSION_TOPICS[number])) {
      setMessage("Choose a topic before publishing.");
      setActiveCreateMetadataTool("topic");
      setPublishing(false);
      return;
    }

    if (topic === "Other" && !realityLens && !purposeLane) {
      setMessage("Choose a Reality Lens or Purpose Lane when Topic is Other.");
      setActiveCreateMetadataTool("reality");
      setPublishing(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    const endpoint = isEditMode
      ? "/api/discussions/update"
      : "/api/discussions/create";

    const payload = isEditMode
      ? {
          discussionId: editingDiscussionId,
          title,
          topic,
          realityLens,
          purposeLane,
          discussionType,
          discussionMetadata: getDiscussionMetadata(),
          body: bodyPlainText,
          tags: tagsInput,
        }
      : {
          title,
          topic,
          realityLens,
          purposeLane,
          discussionType,
          discussionMetadata: getDiscussionMetadata(),
          body: bodyPlainText,
          tags: tagsInput,
        };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      const safetyWarningResult = getSafetyWarningFromResult(result);

      if (safetyWarningResult) {
        setSafetyWarning(safetyWarningResult);
        setMessage("");
      } else {
        setMessage(result.error ?? (isEditMode ? "Unable to save changes." : "Unable to publish discussion."));
      }

      setPublishing(false);
      return;
    }

    if (!isEditMode && draftId) {
      await fetch("/api/discussion-drafts", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          draftId,
        }),
      });
    }

    const discussionId = result.discussion?.id ?? editingDiscussionId;

    if (!isEditMode && discussionId && attachmentFiles.length > 0) {
      const attachmentsUploaded = await uploadDiscussionAttachments({
        discussionId,
        accessToken: sessionData.session.access_token,
      });

      if (!attachmentsUploaded) {
        setPublishing(false);
        setMessage("Discussion was published, but one or more attachments could not be saved. You can open the discussion now or try again later.");
        return;
      }
    }

    window.location.href = `/discussions/${discussionId}`;
  }

  function handleFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      handleCreate(event);
    }
  }

  function getCreateSignalTabClass(isActive: boolean) {
    return `relative flex h-10 items-center justify-center text-[0.95rem] font-semibold tracking-tight transition ${
      isActive
        ? "text-[var(--loombus-text)]"
        : "text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"
    }`;
  }

  function getDiscussionModeShellClass(isActive: boolean) {
    return `rounded-[1.15rem] border px-3 py-3 text-left transition active:scale-[0.99] ${
      isActive
        ? "border-[var(--loombus-text-subtle)] bg-[var(--loombus-surface-strong)] text-[var(--loombus-text)] shadow-md shadow-black/10"
        : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)] hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-strong)] hover:text-[var(--loombus-text)]"
    }`;
  }

  function getDiscussionModeShortDescription(mode: DiscussionMode) {
    if (mode === "debate") {
      return "Claim + argument";
    }

    if (mode === "research_question") {
      return "Context + questions";
    }

    if (mode === "problem_solving") {
      return "Problem + constraints";
    }

    return "Thought or question";
  }

  function toggleCreateMetadataTool(
    tool: "topic" | "reality" | "purpose" | "tags"
  ) {
    setActiveCreateTool("none");
    setActiveCreateMetadataTool((current) => current === tool ? "none" : tool);
  }

  function selectTopicValue(nextTopic: string) {
    setTopic(nextTopic);
    setTopicManuallySelected(true);
    setActiveCreateMetadataTool("none");
  }

  function selectOtherTopicValue() {
    setTopic("Other");
    setTopicManuallySelected(true);
    setActiveCreateMetadataTool("other");
  }

  function applyRecommendedTopic() {
    if (!recommendedTopic) {
      return;
    }

    selectTopicValue(recommendedTopic);
  }

  function selectRealityLensValue(nextLens: string) {
    setRealityLens(nextLens);
    setActiveCreateMetadataTool("none");
  }

  function selectPurposeLaneValue(nextLane: string) {
    setPurposeLane(nextLane);
    setActiveCreateMetadataTool("none");
  }

  function updateTagsValue(nextTags: string) {
    setTagsInput(nextTags);
  }

  function closeTagsPanel() {
    setActiveCreateMetadataTool("none");
  }

  function toggleCreateTool(tool: "attachments" | "quality" | "rewrite") {
    setActiveCreateMetadataTool("none");
    setActiveCreateTool((current) => current === tool ? "none" : tool);
  }

  function syncBodyFromEditor() {
    const rawHtml = bodyEditorRef.current?.innerHTML ?? "";
    const nextBody = sanitizeLimitedDiscussionHtml(rawHtml);

    setBody(nextBody);
  }

  function runBodyEditorCommand(command: "bold" | "italic") {
    bodyEditorRef.current?.focus();
    document.execCommand(command, false);
    syncBodyFromEditor();
  }

  function handleBodyEditorPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();

    const pastedText = event.clipboardData.getData("text/plain");

    if (!pastedText) {
      return;
    }

    document.execCommand("insertText", false, pastedText);
    syncBodyFromEditor();
  }

  function openBodyAttachmentPicker() {
    if (isEditMode || publishing) {
      return;
    }

    setActiveCreateMetadataTool("none");
    setActiveCreateTool("attachments");
    bodyAttachmentInputRef.current?.click();
  }

  useEffect(() => {
    const editor = bodyEditorRef.current;

    if (!editor) {
      return;
    }

    const nextHtml = bodyValueToEditorHtml(body);

    if (document.activeElement === editor) {
      return;
    }

    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
  }, [body]);

  return (
    <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16 loombus-shell-with-right-rail">
      <SafetyWarningModal
        warning={safetyWarning}
        onClose={() => setSafetyWarning(null)}
      />

      <div className="mx-auto max-w-[46rem]">
        <Link
          href={isEditMode && editingDiscussionId ? `/discussions/${editingDiscussionId}` : "/discussions"}
          className="mb-3 inline-block text-sm text-zinc-500 hover:text-white sm:mb-10"
        >
          ← Back to {isEditMode ? "discussion" : "discussions"}
        </Link>

        <p className="mb-1.5 text-xs uppercase tracking-[0.22em] text-zinc-500 sm:mb-3 sm:text-sm sm:tracking-[0.3em]">
          {isEditMode ? "Edit Discussion" : "New Discussion"}
        </p>

        <h1 className="mb-2 text-2xl font-semibold tracking-tight sm:mb-4 sm:text-4xl md:text-5xl">
          {isEditMode
            ? "Edit discussion."
            : draftId
              ? "Edit draft."
              : "Create a discussion."}
        </h1>

        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:mb-8 sm:text-base">
          {isEditMode
            ? "Make a clear, accountable update to your published discussion."
            : "Start a thoughtful discussion designed around signal, clarity, and meaningful contribution."}
        </p>

        {!authChecked && (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30 sm:p-7">
            <p className="text-zinc-400">
              Checking your account status...
            </p>
          </div>
        )}

        {authChecked && !isLoggedIn && (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30 sm:p-7">
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
              Login Required
            </p>

            <h2 className="mb-3 text-xl font-medium sm:text-2xl">
              Log in to create or edit a discussion.
            </h2>

            <p className="mb-6 leading-relaxed text-zinc-400">
              You can browse discussions without an account, but you need to log in before starting or editing a conversation.
            </p>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <Link
                href="/login"
                className="rounded-full bg-white px-6 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Log In
              </Link>

              <Link
                href="/signup"
                className="rounded-full border border-zinc-700 px-6 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Create Account
              </Link>
            </div>
          </div>
        )}

        {authChecked && isLoggedIn && !canCreateOrEditDiscussion && (
          <div className="mb-5 rounded-2xl border border-amber-900 bg-amber-950/20 p-4 sm:mb-8 sm:p-5">
            <p className="mb-2 text-sm font-medium text-amber-200">
              Complete your public profile before posting.
            </p>

            <p className="mb-4 text-sm leading-relaxed text-amber-100/80">
              Loombus asks members to use a recognizable public name before publishing discussions or replies. You can still save drafts and update your profile.
            </p>

            <Link
              href="/profile"
              className="text-sm text-amber-100 underline decoration-amber-700 underline-offset-4 transition hover:text-white hover:decoration-white"
            >
              Open profile →
            </Link>
          </div>
        )}

        {authChecked && isLoggedIn && !profileComplete && (
          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:p-5">
            <p className="mb-2 text-sm font-medium text-zinc-300">
              Your profile is not complete yet.
            </p>

            <p className="mb-4 text-sm leading-relaxed text-zinc-500">
              You can still publish, but adding your {missingProfileFields.join(", ")}
              helps other members recognize your contributions.
            </p>

            <Link
              href="/profile"
              className="text-sm text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-white"
            >
              Complete your profile →
            </Link>
          </div>
        )}

        {authChecked && isLoggedIn && !isEditMode && !canUseDrafts && (
          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:p-5">
            <p className="mb-2 text-sm font-medium text-zinc-300">
              Draft mode is a Premium feature.
            </p>

            <p className="mb-4 text-sm leading-relaxed text-zinc-500">
              You can still publish discussions normally. Premium accounts can save drafts before publishing.
            </p>

            <Link
              href="/premium"
              className="text-sm text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-white"
            >
              View Premium options →
            </Link>
          </div>
        )}

        {authChecked && isLoggedIn && isEditMode && (
          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:p-5">
            <p className="mb-2 text-sm font-medium text-zinc-300">
              Edit window
            </p>

            <p className="text-sm leading-relaxed text-zinc-500">
              {getEditWindowLabel(entitlement, isAdmin)}
              {editingDiscussionMeta?.edited_at
                ? ` · Last edited ${new Date(editingDiscussionMeta.edited_at).toLocaleString()}`
                : ""}
            </p>
          </div>
        )}

        {authChecked && isLoggedIn && (
          <form
            onSubmit={handleCreate}
            onKeyDown={handleFormKeyDown}
            className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 sm:space-y-6 sm:p-8"
          >
            <div
              className={`loombus-mobile-topbar fixed left-0 right-0 top-0 z-30 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+4.32rem)] backdrop-blur-xl transition-transform duration-300 md:hidden ${
                createSignalBarHidden ? "-translate-y-full" : "translate-y-0"
              }`}
            >
              <nav
                aria-label="Create signal controls"
                className="mx-auto grid max-w-md grid-cols-3 border-t border-[var(--loombus-border)] pt-2"
              >
                <button
                  type="button"
                  onClick={() => toggleCreateMetadataTool("topic")}
                  className={getCreateSignalTabClass(activeCreateMetadataTool === "topic" || Boolean(topic))}
                  aria-expanded={activeCreateMetadataTool === "topic"}
                >
                  Topic
                  <span
                    className={`absolute bottom-0 h-1 w-14 rounded-full transition ${
                      activeCreateMetadataTool === "topic" || Boolean(topic)
                        ? "bg-[var(--loombus-text)]"
                        : "bg-transparent"
                    }`}
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  onClick={() => toggleCreateMetadataTool("reality")}
                  className={getCreateSignalTabClass(activeCreateMetadataTool === "reality" || Boolean(realityLens))}
                  aria-expanded={activeCreateMetadataTool === "reality"}
                >
                  Reality Lens
                  <span
                    className={`absolute bottom-0 h-1 w-24 rounded-full transition ${
                      activeCreateMetadataTool === "reality" || Boolean(realityLens)
                        ? "bg-[var(--loombus-text)]"
                        : "bg-transparent"
                    }`}
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  onClick={() => toggleCreateMetadataTool("purpose")}
                  className={getCreateSignalTabClass(activeCreateMetadataTool === "purpose" || Boolean(purposeLane))}
                  aria-expanded={activeCreateMetadataTool === "purpose"}
                >
                  Purpose Lane
                  <span
                    className={`absolute bottom-0 h-1 w-24 rounded-full transition ${
                      activeCreateMetadataTool === "purpose" || Boolean(purposeLane)
                        ? "bg-[var(--loombus-text)]"
                        : "bg-transparent"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </nav>
            </div>

            <section className="space-y-5">
              <div>
                <p className="mb-4 text-xs uppercase tracking-[0.18em] text-zinc-600">
                  Discussion details
                </p>

                <div className="hidden gap-4 md:grid md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-zinc-400">
                      Topic
                    </label>

                    <button
                      type="button"
                      onClick={() => toggleCreateMetadataTool("topic")}
                      className={`flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-base transition ${
                        activeCreateMetadataTool === "topic" || topicManuallySelected
                          ? "border-zinc-600 bg-black text-white"
                          : "border-zinc-800 bg-black text-zinc-500 hover:border-zinc-600 hover:text-white"
                      }`}
                      aria-expanded={activeCreateMetadataTool === "topic"}
                    >
                      <span className="truncate">{topic || "Select topic"}</span>
                      <span className="ml-3 text-zinc-600">⌄</span>
                    </button>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-zinc-400">
                      Categorization
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => toggleCreateMetadataTool("reality")}
                        className={`flex min-h-14 items-center justify-between rounded-2xl border px-4 py-3 text-left text-base transition ${
                          activeCreateMetadataTool === "reality" || Boolean(realityLens)
                            ? "border-zinc-600 bg-black text-white"
                            : "border-zinc-800 bg-black text-zinc-500 hover:border-zinc-600 hover:text-white"
                        }`}
                        aria-expanded={activeCreateMetadataTool === "reality"}
                      >
                        <span className="truncate">{realityLens || "Reality Lens"}</span>
                        <span className="ml-3 text-zinc-600">⌄</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleCreateMetadataTool("purpose")}
                        className={`flex min-h-14 items-center justify-between rounded-2xl border px-4 py-3 text-left text-base transition ${
                          activeCreateMetadataTool === "purpose" || Boolean(purposeLane)
                            ? "border-zinc-600 bg-black text-white"
                            : "border-zinc-800 bg-black text-zinc-500 hover:border-zinc-600 hover:text-white"
                        }`}
                        aria-expanded={activeCreateMetadataTool === "purpose"}
                      >
                        <span className="truncate">{purposeLane || "Purpose Lane"}</span>
                        <span className="ml-3 text-zinc-600">⌄</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black/40 p-4">
                <div className="rounded-[1.25rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]/60 p-3">
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-[var(--loombus-text)]">
                      Discussion Type
                    </label>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--loombus-text-muted)]">
                      Choose a structure when the conversation needs more focus.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {DISCUSSION_MODES.map((mode) => {
                      const modeActive = discussionType === mode.value;

                      return (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => setDiscussionType(mode.value)}
                          className={getDiscussionModeShellClass(modeActive)}
                          aria-pressed={modeActive}
                        >
                          <span className="block text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
                            {mode.value === "open_discussion"
                              ? "Open"
                              : mode.value === "research_question"
                                ? "Research"
                                : mode.value === "problem_solving"
                                  ? "Solve"
                                  : "Debate"}
                          </span>

                          <span className="mt-2 block text-lg font-semibold leading-tight tracking-tight text-[var(--loombus-text)]">
                            {mode.label}
                          </span>

                          <span className="mt-1.5 block text-xs font-medium leading-snug text-[var(--loombus-text-muted)]">
                            {getDiscussionModeShortDescription(mode.value)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {discussionType === "debate" && (
                  <div className="mt-4 grid gap-3">
                    <input
                      type="text"
                      value={modeClaim}
                      onChange={(event) => setModeClaim(event.target.value)}
                      placeholder="Claim"
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500"
                    />
                    <textarea
                      value={modeSupportingArgument}
                      onChange={(event) => setModeSupportingArgument(event.target.value)}
                      placeholder="Supporting argument"
                      rows={3}
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500"
                    />
                    <textarea
                      value={modeEvidence}
                      onChange={(event) => setModeEvidence(event.target.value)}
                      placeholder="Evidence or source context optional"
                      rows={3}
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500"
                    />
                    <input
                      type="text"
                      value={modeOpposingQuestion}
                      onChange={(event) => setModeOpposingQuestion(event.target.value)}
                      placeholder="Question for opposing views"
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500"
                    />
                  </div>
                )}

                {discussionType === "research_question" && (
                  <div className="mt-4 grid gap-3">
                    <input
                      type="text"
                      value={modeResearchQuestion}
                      onChange={(event) => setModeResearchQuestion(event.target.value)}
                      placeholder="Research question"
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500"
                    />
                    <textarea
                      value={modeBackground}
                      onChange={(event) => setModeBackground(event.target.value)}
                      placeholder="Background context"
                      rows={3}
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500"
                    />
                    <textarea
                      value={modeSources}
                      onChange={(event) => setModeSources(event.target.value)}
                      placeholder="Sources optional"
                      rows={3}
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500"
                    />
                    <textarea
                      value={modeOpenQuestions}
                      onChange={(event) => setModeOpenQuestions(event.target.value)}
                      placeholder="Unresolved or open questions"
                      rows={3}
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500"
                    />
                  </div>
                )}

                {discussionType === "problem_solving" && (
                  <div className="mt-4 grid gap-3">
                    <input
                      type="text"
                      value={modeProblem}
                      onChange={(event) => setModeProblem(event.target.value)}
                      placeholder="Problem"
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500"
                    />
                    <textarea
                      value={modeTried}
                      onChange={(event) => setModeTried(event.target.value)}
                      placeholder="What have you tried?"
                      rows={3}
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500"
                    />
                    <textarea
                      value={modeConstraints}
                      onChange={(event) => setModeConstraints(event.target.value)}
                      placeholder="Constraints"
                      rows={3}
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500"
                    />
                    <input
                      type="text"
                      value={modeDesiredOutcome}
                      onChange={(event) => setModeDesiredOutcome(event.target.value)}
                      placeholder="Desired outcome"
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-400">
                  Optional Tags
                </label>

                <input
                  type="text"
                  value={tagsInput}
                  onChange={(event) => updateTagsValue(event.target.value)}
                  onFocus={() => setActiveCreateMetadataTool("tags")}
                  onBlur={closeTagsPanel}
                  placeholder="Optional Tags"
                  className="min-h-14 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
                />

                <div className="mt-3 flex flex-col gap-2 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    {tagInputHelper}
                  </p>

                  {!isEditMode && draftId && (
                    <p>
                      Tags are saved when publishing, not while saving drafts.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {activeCreateMetadataTool !== "none" && activeCreateMetadataTool !== "tags" && (
              <section
                className="fixed inset-0 z-50 pointer-events-none"
                role="dialog"
                aria-modal="false"
                aria-label="Create signal selector"
              >
                <button
                  type="button"
                  aria-label="Close selector"
                  onClick={() => setActiveCreateMetadataTool("none")}
                  className="absolute inset-0 pointer-events-auto cursor-default bg-transparent"
                />

                <div
                  className="pointer-events-auto fixed left-1/2 top-[calc(env(safe-area-inset-top)+8.65rem)] z-50 max-h-[min(62vh,28rem)] w-[min(calc(100vw-5rem),21rem)] -translate-x-1/2 overflow-y-auto rounded-[1.75rem] border border-[var(--loombus-text-subtle)] p-3 shadow-2xl shadow-black/35 backdrop-blur-2xl sm:top-[calc(env(safe-area-inset-top)+12rem)] sm:w-[22rem]"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--loombus-surface-muted) 88%, var(--loombus-page-bg) 12%)",
                  }}
                >
                  <div className="mb-3 flex items-start justify-between gap-3 rounded-[1.35rem] border border-[var(--loombus-border)] px-3 py-3"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--loombus-surface) 76%, var(--loombus-page-bg) 24%)",
                    }}
                  >
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-[0.22em] text-zinc-600">
                        Create Signal
                      </p>

                      <h2 className="text-base font-semibold tracking-tight text-zinc-100">
                        {activeCreateMetadataTool === "topic"
                          ? "Choose a topic"
                          : activeCreateMetadataTool === "other"
                            ? "Choose signal type"
                            : activeCreateMetadataTool === "reality"
                              ? "Choose a Reality Lens"
                              : "Choose a Purpose Lane"}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveCreateMetadataTool("none")}
                      className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/25 hover:bg-black/30 hover:text-white"
                    >
                      Close
                    </button>
                  </div>

                  {/* Create signal popup dropdown list polish. */}
                  {activeCreateMetadataTool === "topic" && (
                    <div>
                      <p className="mb-3 text-sm leading-relaxed text-zinc-500">
                        Choose a topic. Select Other when the discussion is better framed by Reality Lens or Purpose Lane.
                      </p>

                      {!topic && recommendedTopic && (
                        <button
                          type="button"
                          onClick={applyRecommendedTopic}
                          className="mb-3 w-full rounded-xl border border-zinc-700 bg-black px-3 py-2.5 text-left text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                        >
                          Recommended topic: {recommendedTopic}
                        </button>
                      )}

                      {!topic && !recommendedTopic && (
                        <p className="mb-3 rounded-xl border border-zinc-900 bg-black px-3 py-2.5 text-sm text-zinc-500">
                          Select the topic that best matches this discussion before publishing.
                        </p>
                      )}

                      <div className="space-y-2" data-create-signal-list="topic">
                        <button
                          type="button"
                          onClick={selectOtherTopicValue}
                          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                            topic === "Other"
                              ? "border-[var(--loombus-text-subtle)] bg-[var(--loombus-surface-strong)] text-[var(--loombus-text)] shadow-sm shadow-black/10"
                              : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)] hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                          }`}
                        >
                          <span>Other</span>
                          {topic === "Other" && <span className="text-xs">Selected</span>}
                        </button>

                        {DISCUSSION_TOPICS.filter((topicOption) => topicOption !== "Other").map((topicOption) => (
                          <button
                            key={topicOption}
                            type="button"
                            onClick={() => selectTopicValue(topicOption)}
                            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                              topicManuallySelected && topic === topicOption
                                ? "border-[var(--loombus-text-subtle)] bg-[var(--loombus-surface-strong)] text-[var(--loombus-text)] shadow-sm shadow-black/10"
                                : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)] hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                            }`}
                          >
                            <span>{topicOption}</span>
                            {topicManuallySelected && topic === topicOption && (
                              <span className="text-xs">Selected</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeCreateMetadataTool === "other" && (
                    <div>
                      <p className="mb-3 text-sm leading-relaxed text-zinc-500">
                        Other requires one additional signal. Choose whether this discussion is better framed by a Reality Lens or a Purpose Lane.
                      </p>

                      <div className="space-y-2" data-create-signal-list="other">
                        <button
                          type="button"
                          onClick={() => setActiveCreateMetadataTool("reality")}
                          className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                        >
                          <span>Reality Lens</span>
                          <span className="text-xs text-zinc-600">Choose</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveCreateMetadataTool("purpose")}
                          className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                        >
                          <span>Purpose Lane</span>
                          <span className="text-xs text-zinc-600">Choose</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeCreateMetadataTool === "reality" && (
                    <div>
                      <p className="mb-3 text-sm leading-relaxed text-zinc-500">
                        Optional. Required if Topic is Other. Use this when the discussion is better framed by a human-life reality than a standard topic.
                      </p>

                      <div className="space-y-2" data-create-signal-list="reality">
                        <button
                          type="button"
                          onClick={() => selectRealityLensValue("")}
                          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                            !realityLens
                              ? "border-[var(--loombus-text-subtle)] bg-[var(--loombus-surface-strong)] text-[var(--loombus-text)] shadow-sm shadow-black/10"
                              : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)] hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                          }`}
                        >
                          <span>None</span>
                          {!realityLens && <span className="text-xs">Selected</span>}
                        </button>

                        {REALITY_LENSES.map((lens) => (
                          <button
                            key={lens}
                            type="button"
                            onClick={() => selectRealityLensValue(lens)}
                            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                              realityLens === lens
                                ? "border-[var(--loombus-text-subtle)] bg-[var(--loombus-surface-strong)] text-[var(--loombus-text)] shadow-sm shadow-black/10"
                                : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)] hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                            }`}
                          >
                            <span>{lens}</span>
                            {realityLens === lens && <span className="text-xs">Selected</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeCreateMetadataTool === "purpose" && (
                    <div>
                      <p className="mb-3 text-sm leading-relaxed text-zinc-500">
                        Optional. Required if Topic is Other. Use this when the discussion points toward learning, contribution, mastery, community, or direction.
                      </p>

                      <div className="space-y-2" data-create-signal-list="purpose">
                        <button
                          type="button"
                          onClick={() => selectPurposeLaneValue("")}
                          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                            !purposeLane
                              ? "border-[var(--loombus-text-subtle)] bg-[var(--loombus-surface-strong)] text-[var(--loombus-text)] shadow-sm shadow-black/10"
                              : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)] hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                          }`}
                        >
                          <span>None</span>
                          {!purposeLane && <span className="text-xs">Selected</span>}
                        </button>

                        {PURPOSE_LANES.map((lane) => (
                          <button
                            key={lane}
                            type="button"
                            onClick={() => selectPurposeLaneValue(lane)}
                            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                              purposeLane === lane
                                ? "border-[var(--loombus-text-subtle)] bg-[var(--loombus-surface-strong)] text-[var(--loombus-text)] shadow-sm shadow-black/10"
                                : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)] hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                            }`}
                          >
                            <span>{lane}</span>
                            {purposeLane === lane && <span className="text-xs">Selected</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </section>
            )}

            {draftId && !isEditMode && (
              <div className="rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-500">
                Editing saved draft
                {draftUpdatedAt ? ` · Updated ${new Date(draftUpdatedAt).toLocaleString()}` : ""}
              </div>
            )}

            {isEditMode && (
              <div className="rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-500">
                Editing published discussion
                {editingDiscussionMeta?.edit_count
                  ? ` · ${editingDiscussionMeta.edit_count} previous edits`
                  : ""}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Discussion Title
              </label>

              <input
                type="text"
                value={title}
                required
                onChange={(e) => setTitle(e.target.value)}
                placeholder="How AI changes trust online"
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
              />

              {similarDiscussions.length > 0 && !isEditMode && (
                <div className="mt-4 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-[color:var(--loombus-text)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--loombus-muted-text)]">
                    Discussion Memory
                  </p>

                  <h3 className="mt-2 text-sm font-semibold">
                    Similar discussions already exist
                  </h3>

                  <p className="mt-1 text-xs leading-relaxed text-[color:var(--loombus-muted-text)]">
                    Loombus found related discussions you may want to read or build on before publishing.
                  </p>

                  <div className="mt-3 grid gap-2">
                    {similarDiscussions.map((discussion) => (
                      <Link
                        key={discussion.id}
                        href={`/discussions/${discussion.id}`}
                        target="_blank"
                        className="rounded-xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-muted-surface)] p-3 transition hover:border-zinc-500"
                      >
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--loombus-muted-text)]">
                          {discussion.topic}
                        </p>
                        <p className="mt-1 text-sm font-medium text-[color:var(--loombus-text)]">
                          {normalizePublicText(discussion.title)}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Discussion Body
              </label>

              <div className="overflow-hidden rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] focus-within:border-[var(--loombus-text-subtle)]">
                <div
                  className="flex items-center gap-2 overflow-x-auto border-b border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-3 py-2"
                  aria-label="Discussion composer tools"
                >
                  <div className="flex shrink-0 items-center gap-1" aria-label="Text formatting">
                    <button
                      type="button"
                      onClick={() => runBodyEditorCommand("bold")}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                      aria-label="Bold selected text"
                      title="Bold"
                    >
                      B
                    </button>

                    <button
                      type="button"
                      onClick={() => runBodyEditorCommand("italic")}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-base italic text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                      aria-label="Italicize selected text"
                      title="Italic"
                    >
                      I
                    </button>
                  </div>

                  <span className="h-7 w-px shrink-0 bg-[var(--loombus-border)]" aria-hidden="true" />

                  <div className="flex shrink-0 items-center gap-1" aria-label="Composer actions">
                    {!isEditMode && (
                      <>
                        <button
                          type="button"
                          onClick={openBodyAttachmentPicker}
                          disabled={publishing}
                          className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            attachmentFiles.length > 0
                              ? "border-[var(--loombus-primary-bg)] bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)] shadow-sm"
                              : "border-transparent text-[var(--loombus-text-muted)] hover:border-[var(--loombus-border)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                          }`}
                          aria-label="Attach files"
                          title="Attach files"
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.55-9.55a4 4 0 1 1 5.66 5.66l-9.9 9.9a2 2 0 1 1-2.83-2.83l8.84-8.84" />
                          </svg>

                          {attachmentFiles.length > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--loombus-text)] px-1 text-[10px] font-semibold text-[var(--loombus-page-bg)]">
                              {attachmentFiles.length}
                            </span>
                          )}
                        </button>

                        <input
                          ref={bodyAttachmentInputRef}
                          type="file"
                          multiple
                          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                          onChange={handleAttachmentSelection}
                          disabled={publishing}
                          className="hidden"
                        />
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleCreateMetadataTool("topic")}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                        activeCreateMetadataTool !== "none" || Boolean(topic || realityLens || purposeLane)
                          ? "border-[var(--loombus-primary-bg)] bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)] shadow-sm"
                          : "border-transparent text-[var(--loombus-text-muted)] hover:border-[var(--loombus-border)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                      }`}
                      aria-label="Discussion structure"
                      title="Discussion structure"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 7h4" />
                        <path d="M4 17h4" />
                        <path d="M16 7h4" />
                        <path d="M16 17h4" />
                        <circle cx="11" cy="7" r="2" />
                        <circle cx="13" cy="17" r="2" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleCreateTool("quality")}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                        activeCreateTool === "quality"
                          ? "border-[var(--loombus-primary-bg)] bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)] shadow-sm"
                          : "border-transparent text-[var(--loombus-text-muted)] hover:border-[var(--loombus-border)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                      }`}
                      aria-label="Quality check"
                      title="Quality check"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleCreateTool("rewrite")}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                        activeCreateTool === "rewrite"
                          ? "border-[var(--loombus-primary-bg)] bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)] shadow-sm"
                          : "border-transparent text-[var(--loombus-text-muted)] hover:border-[var(--loombus-border)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                      }`}
                      aria-label="Rewrite for clarity"
                      title="Rewrite for clarity"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 3 13.4 8.1 18.5 9.5 13.4 10.9 12 16 10.6 10.9 5.5 9.5 10.6 8.1 12 3Z" />
                        <path d="M19 15 19.6 17.2 22 18 19.6 18.8 19 21 18.4 18.8 16 18 18.4 17.2 19 15Z" />
                      </svg>
                    </button>

                    {canUseDrafts && !isEditMode && (
                      <button
                        type="button"
                        onClick={saveDraft}
                        disabled={savingDraft || publishing}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          draftId
                            ? "border-[var(--loombus-primary-bg)] bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)] shadow-sm"
                            : "border-transparent text-[var(--loombus-text-muted)] hover:border-[var(--loombus-border)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                        }`}
                        aria-label={savingDraft ? "Saving draft" : "Save draft"}
                        title={savingDraft ? "Saving draft" : "Save draft"}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                          <path d="M17 21v-8H7v8" />
                          <path d="M7 3v5h8" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  {!bodyPlainText.trim() && (
                    <span className="pointer-events-none absolute left-4 top-4 text-base text-[var(--loombus-text-subtle)]">
                      Write your discussion...
                    </span>
                  )}

                  <div
                    ref={bodyEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Discussion body"
                    onInput={syncBodyFromEditor}
                    onBlur={syncBodyFromEditor}
                    onPaste={handleBodyEditorPaste}
                    className="min-h-[22rem] w-full overflow-y-auto whitespace-pre-wrap break-words border-0 bg-[var(--loombus-surface)] px-4 py-4 text-base leading-relaxed text-[var(--loombus-text)] outline-none"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
                <p className={isBodyOverLimit ? "text-red-400" : ""}>
                  {bodyCharacterCount.toLocaleString()}/{maxDiscussionLength.toLocaleString()} characters
                </p>

                <p>
                  {canUseLongPosts
                    ? "Expanded long-post limit active."
                    : "Upgrade to Premium Plus for longer discussion posts."}
                </p>
              </div>

              {attachmentFiles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {attachmentFiles.map((file) => (
                    <span
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs text-zinc-500"
                    >
                      {file.name}
                    </span>
                  ))}
                </div>
              )}

              {attachmentMessage && (
                <p className="mt-3 text-sm text-zinc-500">
                  {attachmentMessage}
                </p>
              )}
            </div>

            {/* AI Assist shell */}
            <section className={`rounded-2xl border border-zinc-800 bg-black/40 p-3 sm:p-5 ${
              activeCreateTool === "quality" || activeCreateTool === "rewrite" ? "block" : "hidden"
            }`}>
              <div className="hidden">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-600">
                    AI Assist
                  </p>

                  <h2 className="text-lg font-medium sm:text-xl">
                    Improve before publishing.
                  </h2>

                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                    Check the quality of your post or generate a clearer version before you publish.
                  </p>
                </div>
              </div>

              <div className="hidden" aria-label="Create AI Assist rail">
                <button
                  type="button"
                  onClick={() => toggleCreateTool("quality")}
                  className={`shrink-0 rounded-full px-4 py-2.5 text-sm transition ${
                    activeCreateTool === "quality"
                      ? "bg-white text-black"
                      : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
                  }`}
                  aria-expanded={activeCreateTool === "quality"}
                >
                  Quality Check
                </button>

                <button
                  type="button"
                  onClick={() => toggleCreateTool("rewrite")}
                  className={`shrink-0 rounded-full px-4 py-2.5 text-sm transition ${
                    activeCreateTool === "rewrite"
                      ? "bg-white text-black"
                      : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
                  }`}
                  aria-expanded={activeCreateTool === "rewrite"}
                >
                  Rewrite
                </button>
              </div>

              {activeCreateTool === "quality" && (
                <section className="mt-4 rounded-2xl border border-zinc-800 bg-black p-3 sm:p-5">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-600">
                        Premium Plus AI
                      </p>

                      <h3 className="text-base font-medium">
                        Discussion quality check
                      </h3>

                      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                        Review clarity, signal, usefulness, and risk before posting.
                      </p>
                    </div>

                    {canUseQualityCheck ? (
                      <button
                        type="button"
                        onClick={runQualityCheck}
                        disabled={generatingQualityCheck || publishing}
                        className="w-full rounded-full border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
                      >
                        {generatingQualityCheck ? "Checking..." : "Run quality check"}
                      </button>
                    ) : (
                      <Link
                        href="/premium"
                        className="w-full rounded-full border border-zinc-800 px-4 py-2.5 text-center text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white sm:w-fit"
                      >
                        Unlock with Premium Plus
                      </Link>
                    )}
                  </div>

                  {qualityCheckMessage && (
                    <p className="mb-3 text-sm text-zinc-500">
                      {qualityCheckMessage}
                    </p>
                  )}

                  {qualityCheck && (
                    <div className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-300">
                      {qualityCheck}
                    </div>
                  )}
                </section>
              )}

              {activeCreateTool === "rewrite" && (
                <section className="mt-4 rounded-2xl border border-zinc-800 bg-black p-3 sm:p-5">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-600">
                        Premium Plus AI
                      </p>

                      <h3 className="text-base font-medium">
                        Rewrite for clarity
                      </h3>

                      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                        Generate a clearer version. It will not replace your text unless you apply it.
                      </p>
                    </div>

                    {canUseQualityCheck ? (
                      <button
                        type="button"
                        onClick={runClarityRewrite}
                        disabled={generatingRewrite || publishing}
                        className="w-full rounded-full border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
                      >
                        {generatingRewrite ? "Rewriting..." : "Generate rewrite"}
                      </button>
                    ) : (
                      <Link
                        href="/premium"
                        className="w-full rounded-full border border-zinc-800 px-4 py-2.5 text-center text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white sm:w-fit"
                      >
                        Unlock with Premium Plus
                      </Link>
                    )}
                  </div>

                  {rewriteMessage && (
                    <p className="mb-3 text-sm text-zinc-500">
                      {rewriteMessage}
                    </p>
                  )}

                  {clarityRewrite && (
                    <div className="space-y-4">
                      <div className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-300">
                        {clarityRewrite}
                      </div>

                      <button
                        type="button"
                        onClick={applyClarityRewrite}
                        className="inline-flex w-full justify-center rounded-full border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-fit"
                      >
                        Use rewrite
                      </button>
                    </div>
                  )}
                </section>
              )}
            </section>

            <section className="hidden">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-600">
                    Optional details
                  </p>

                  <p className="text-sm text-zinc-400">
                    Topic, life context, direction, and tags.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowOptionalDetails((current) => !current)}
                  className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-fit"
                  aria-expanded={showOptionalDetails}
                >
                  {showOptionalDetails ? "Hide details" : "Show details"}
                </button>
              </div>

              {showOptionalDetails && (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm text-zinc-400">
                        Topic
                      </label>

                      <select
                        value={topic}
                        onChange={(e) => { setTopic(e.target.value); setTopicManuallySelected(Boolean(e.target.value)); }}
                        className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
                      >
                        <option value="">Select a topic</option>
                        {DISCUSSION_TOPICS.map((topicOption) => (
                          <option key={topicOption} value={topicOption}>
                            {topicOption}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-zinc-400">
                        Reality Lens optional
                      </label>

                      <select
                        value={realityLens}
                        onChange={(e) => setRealityLens(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
                      >
                        <option value="">No reality lens</option>
                        {REALITY_LENSES.map((lens) => (
                          <option key={lens} value={lens}>
                            {lens}
                          </option>
                        ))}
                      </select>

                      <p className="mt-2 text-xs text-zinc-600">
                        Add a human-reality lens if this discussion touches a deeper life experience.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-zinc-400">
                        Purpose Lane optional
                      </label>

                      <select
                        value={purposeLane}
                        onChange={(e) => setPurposeLane(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
                      >
                        <option value="">No purpose lane</option>
                        {PURPOSE_LANES.map((lane) => (
                          <option key={lane} value={lane}>
                            {lane}
                          </option>
                        ))}
                      </select>

                      <p className="mt-2 text-xs text-zinc-600">
                        Add a direction if this discussion points toward learning, contribution, mastery, or community.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-zinc-400">
                      Optional Tags
                    </label>

                    <input
                      type="text"
                      value={tagsInput}
                      onChange={(event) => setTagsInput(event.target.value)}
                      placeholder="AI ethics, publishing, startups"
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
                    />

                    <div className="mt-3 flex flex-col gap-2 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
                      <p>
                        {tagInputHelper}
                      </p>

                      {!isEditMode && draftId && (
                        <p>
                          Tags are saved when publishing, not while saving drafts.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {!isEditMode && (
              <div className="hidden">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-600">
                  Composer tools
                </p>

                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Create composer tools rail">
                  <button
                    type="button"
                    onClick={() => toggleCreateTool("attachments")}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-sm transition ${
                      activeCreateTool === "attachments" || attachmentFiles.length > 0
                        ? "bg-white text-black"
                        : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
                    }`}
                    aria-expanded={activeCreateTool === "attachments"}
                  >
                    {attachmentFiles.length > 0 ? `${attachmentFiles.length} attached` : "Attachments"}
                  </button>
                </div>
              </div>
            )}

            {!isEditMode && activeCreateTool === "attachments" && (
              <section className="hidden">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <p className="text-sm leading-relaxed text-zinc-500">
                    Optional. Attach files that support the discussion. Max 10 MB each.
                  </p>

                  {attachmentFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAttachments}
                      disabled={publishing}
                      className="w-full rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700 sm:w-fit"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  onChange={handleAttachmentSelection}
                  disabled={publishing}
                  className="block w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-400 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-black disabled:cursor-not-allowed disabled:text-zinc-700"
                />

                {attachmentFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {attachmentFiles.map((file) => (
                      <div
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="flex flex-col gap-1 rounded-xl border border-zinc-900 bg-zinc-950 p-3 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="truncate">
                          {file.name}
                        </span>

                        <span className="text-xs text-zinc-600">
                          {file.type === "application/pdf" ? "PDF" : "Image"} · {formatAttachmentFileSize(file.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {attachmentMessage && (
                  <p className="mt-3 text-sm text-zinc-500">
                    {attachmentMessage}
                  </p>
                )}
              </section>
            )}

            {!isEditMode && (
              <section className="hidden">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-600">
                      Optional attachments
                    </p>

                    <p className="text-sm text-zinc-400">
                      Add up to 3 images or PDFs.
                      {attachmentFiles.length > 0 ? ` ${attachmentFiles.length} selected.` : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAttachmentsPanel((current) => !current)}
                    className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-fit"
                    aria-expanded={showAttachmentsPanel}
                  >
                    {showAttachmentsPanel ? "Hide attachments" : "Add attachments"}
                  </button>
                </div>

                {showAttachmentsPanel && (
                  <div className="mt-5">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="text-sm leading-relaxed text-zinc-500">
                        Optional. Attach files that support the discussion. Max 10 MB each.
                      </p>

                      {attachmentFiles.length > 0 && (
                        <button
                          type="button"
                          onClick={clearAttachments}
                          disabled={publishing}
                          className="w-full rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700 sm:w-fit"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                      onChange={handleAttachmentSelection}
                      disabled={publishing}
                      className="block w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-400 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-black disabled:cursor-not-allowed disabled:text-zinc-700"
                    />

                    {attachmentFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {attachmentFiles.map((file) => (
                          <div
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="flex flex-col gap-1 rounded-xl border border-zinc-900 bg-zinc-950 p-3 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="truncate">
                              {file.name}
                            </span>

                            <span className="text-xs text-zinc-600">
                              {file.type === "application/pdf" ? "PDF" : "Image"} · {formatAttachmentFileSize(file.size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {attachmentMessage && (
                      <p className="mt-3 text-sm text-zinc-500">
                        {attachmentMessage}
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}

            <section className="hidden">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-600">
                    Optional writing tools
                  </p>

                  <p className="text-sm text-zinc-400">
                    Quality check and clarity rewrite.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowWritingTools((current) => !current)}
                  className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-fit"
                  aria-expanded={showWritingTools}
                >
                  {showWritingTools ? "Hide writing tools" : "Writing tools"}
                </button>
              </div>

              {showWritingTools && (
                <div className="mt-5 space-y-4">
                  <section className="rounded-2xl border border-zinc-800 bg-black p-3 sm:p-5">
              <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
                    Premium Plus AI
                  </p>

                  <h2 className="text-lg font-medium sm:text-xl">
                    Discussion quality check
                  </h2>

                  <p className="mt-2 hidden text-sm leading-relaxed text-zinc-500 sm:block">
                    Get concise feedback before posting. This does not rewrite
                    or publish anything.
                  </p>
                </div>

                {canUseQualityCheck ? (
                  <button
                    type="button"
                    onClick={runQualityCheck}
                    disabled={generatingQualityCheck || publishing}
                    className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
                  >
                    {generatingQualityCheck ? "Checking..." : "Run quality check"}
                  </button>
                ) : (
                  <Link
                    href="/premium"
                    className="w-full rounded-full border border-zinc-800 px-5 py-3 text-center text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white sm:w-fit"
                  >
                    Unlock with Premium Plus
                  </Link>
                )}
              </div>

              {qualityCheckMessage && (
                <p className="mb-4 text-sm text-zinc-500">
                  {qualityCheckMessage}
                </p>
              )}

              {qualityCheck && (
                <div className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-300">
                  {qualityCheck}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-black p-3 sm:p-5">
              <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
                    Premium Plus AI
                  </p>

                  <h2 className="text-lg font-medium sm:text-xl">
                    Rewrite for clarity
                  </h2>

                  <p className="mt-2 hidden text-sm leading-relaxed text-zinc-500 sm:block">
                    Generate a clearer version of your discussion body. It will
                    not replace your text unless you apply it.
                  </p>
                </div>

                {canUseQualityCheck ? (
                  <button
                    type="button"
                    onClick={runClarityRewrite}
                    disabled={generatingRewrite || publishing}
                    className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
                  >
                    {generatingRewrite ? "Rewriting..." : "Generate rewrite"}
                  </button>
                ) : (
                  <Link
                    href="/premium"
                    className="w-full rounded-full border border-zinc-800 px-5 py-3 text-center text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white sm:w-fit"
                  >
                    Unlock with Premium Plus
                  </Link>
                )}
              </div>

              {rewriteMessage && (
                <p className="mb-4 text-sm text-zinc-500">
                  {rewriteMessage}
                </p>
              )}

              {clarityRewrite && (
                <div className="space-y-4">
                  <div className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-300">
                    {clarityRewrite}
                  </div>

                  <button
                    type="button"
                    onClick={applyClarityRewrite}
                    className="inline-flex w-full justify-center rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-fit"
                  >
                    Use rewrite
                  </button>
                </div>
              )}
            </section>
                </div>
              )}
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
                <button
                  type="submit"
                  disabled={publishing || isBodyOverLimit || !canCreateOrEditDiscussion}
                  className="w-full rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200 disabled:opacity-50 sm:w-fit"
                >
                  {publishing
                    ? isEditMode ? "Saving..." : "Publishing..."
                    : !canCreateOrEditDiscussion
                      ? "Complete Profile First"
                      : isEditMode ? "Save Changes" : "Publish Discussion"}
                </button>

                {canUseDrafts && !isEditMode && (
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={savingDraft || publishing}
                    className="w-full rounded-full border border-zinc-700 px-6 py-3 text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
                  >
                    {savingDraft ? "Saving..." : "Save Draft"}
                  </button>
                )}
              </div>

              <p className="hidden text-sm text-zinc-600 sm:block">
                Press Cmd+Enter or Ctrl+Enter to {isEditMode ? "save changes" : "publish"}.
              </p>
            </div>

            {message && <p className="text-sm text-zinc-400">{message}</p>}
          </form>
        )}
      <aside className="loombus-right-rail fixed inset-y-0 right-0 z-30 hidden overflow-y-auto border-l border-zinc-900 bg-black/95 px-4 py-6 backdrop-blur-xl lg:block">
        <div className="space-y-4">
          {false && authChecked && isLoggedIn && showOptionalDetails && (
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
              <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                Optional details
              </p>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Topic
                  </label>

                  <select
                    value={topic}
                    onChange={(event) => { setTopic(event.target.value); setTopicManuallySelected(Boolean(event.target.value)); }}
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
                  >
                    <option value="">Select a topic</option>
                    {DISCUSSION_TOPICS.map((topicOption) => (
                      <option key={topicOption} value={topicOption}>
                        {topicOption}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Reality Lens optional
                  </label>

                  <select
                    value={realityLens}
                    onChange={(event) => setRealityLens(event.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
                  >
                    <option value="">No reality lens</option>
                    {REALITY_LENSES.map((lens) => (
                      <option key={lens} value={lens}>
                        {lens}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Purpose Lane optional
                  </label>

                  <select
                    value={purposeLane}
                    onChange={(event) => setPurposeLane(event.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
                  >
                    <option value="">No purpose lane</option>
                    {PURPOSE_LANES.map((lane) => (
                      <option key={lane} value={lane}>
                        {lane}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Optional Tags
                  </label>

                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(event) => setTagsInput(event.target.value)}
                    placeholder="AI ethics, publishing, startups"
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
                  />

                  <p className="mt-2 text-xs text-zinc-600">
                    {tagInputHelper}
                  </p>
                </div>
              </div>
            </section>
          )}

          {authChecked && isLoggedIn && !isEditMode && (
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
              {/* Right rail My Activity card. */}
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Your account
              </p>

              <h2 className="text-lg font-semibold tracking-tight text-white">
                My Activity
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Review your discussions, replies, saves, and recent Loombus activity from one place.
              </p>

              <div className="mt-5 grid gap-2">
                <Link
                  href="/my-activity"
                  className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white"
                >
                  Open My Activity
                </Link>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/my-discussions"
                    className="rounded-2xl border border-zinc-800 bg-black/70 px-3 py-3 text-center text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                  >
                    Discussions
                  </Link>

                  <Link
                    href="/my-replies"
                    className="rounded-2xl border border-zinc-800 bg-black/70 px-3 py-3 text-center text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                  >
                    Replies
                  </Link>
                </div>
              </div>
            </section>
          )}

          {false && authChecked && isLoggedIn && showWritingTools && (
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
              <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                Optional writing tools
              </p>

              <div className="space-y-4">
                <section className="rounded-2xl border border-zinc-800 bg-black p-4">
                  <div className="mb-3 flex flex-col gap-3">
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-600">
                        Premium Plus AI
                      </p>

                      <h2 className="text-base font-medium">
                        Discussion quality check
                      </h2>
                    </div>

                    {canUseQualityCheck ? (
                      <button
                        type="button"
                        onClick={runQualityCheck}
                        disabled={generatingQualityCheck || publishing}
                        className="w-full rounded-full border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {generatingQualityCheck ? "Checking..." : "Run quality check"}
                      </button>
                    ) : (
                      <Link
                        href="/premium"
                        className="w-full rounded-full border border-zinc-800 px-4 py-2.5 text-center text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                      >
                        Unlock with Premium Plus
                      </Link>
                    )}
                  </div>

                  {qualityCheckMessage && (
                    <p className="mb-3 text-sm text-zinc-500">
                      {qualityCheckMessage}
                    </p>
                  )}

                  {qualityCheck && (
                    <div className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-300">
                      {qualityCheck}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-zinc-800 bg-black p-4">
                  <div className="mb-3 flex flex-col gap-3">
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-600">
                        Premium Plus AI
                      </p>

                      <h2 className="text-base font-medium">
                        Rewrite for clarity
                      </h2>
                    </div>

                    {canUseQualityCheck ? (
                      <button
                        type="button"
                        onClick={runClarityRewrite}
                        disabled={generatingRewrite || publishing}
                        className="w-full rounded-full border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {generatingRewrite ? "Rewriting..." : "Generate rewrite"}
                      </button>
                    ) : (
                      <Link
                        href="/premium"
                        className="w-full rounded-full border border-zinc-800 px-4 py-2.5 text-center text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                      >
                        Unlock with Premium Plus
                      </Link>
                    )}
                  </div>

                  {rewriteMessage && (
                    <p className="mb-3 text-sm text-zinc-500">
                      {rewriteMessage}
                    </p>
                  )}

                  {clarityRewrite && (
                    <div className="space-y-4">
                      <div className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-300">
                        {clarityRewrite}
                      </div>

                      <button
                        type="button"
                        onClick={applyClarityRewrite}
                        className="inline-flex w-full justify-center rounded-full border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                      >
                        Use rewrite
                      </button>
                    </div>
                  )}
                </section>
              </div>
            </section>
          )}
        </div>
      </aside>

      </div>
    </main>
  );
}
