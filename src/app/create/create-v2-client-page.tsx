"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Brain,
  CheckCircle2,
  Circle,
  FileText,
  MessageSquare,
  Mic,
  Paperclip,
  Plus,
  Puzzle,
  Save,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { REALITY_LENSES } from "@/lib/reality-lenses";
import { PURPOSE_LANES } from "@/lib/purpose-lanes";
import {
  DISCUSSION_ATTACHMENT_ACCEPT,
  MAX_DISCUSSION_ATTACHMENTS,
  NON_VIDEO_ATTACHMENT_MAX_SIZE_BYTES,
  NON_VIDEO_ATTACHMENT_MIME_TYPES,
  VIDEO_CONTEXT_ALLOWED_MIME_TYPES,
  getAttachmentKindForMimeType,
  isVideoContextMimeType,
} from "@/lib/video-context-limits";
import {
  SafetyWarningModal,
  getSafetyWarningFromResult,
  type SafetyWarningState,
} from "@/components/safety-warning-modal";

type DiscussionMode = "open_discussion" | "debate" | "research_question" | "problem_solving";
type PickerPanel = "topics" | "reality" | "purpose";
type ContextKind = "file" | "video";

type ModeOption = {
  key: DiscussionMode;
  label: string;
  shortLabel: string;
  description: string;
  Icon: LucideIcon;
};

type Finding = {
  label: string;
  done: boolean;
  detail: string;
};

type ContextItem = {
  id: string;
  file: File;
  kind: ContextKind;
};

type DraftRow = {
  id: string;
  title: string | null;
  topic: string | null;
  reality_lens: string | null;
  purpose_lane: string | null;
  body: string | null;
  updated_at: string | null;
};

const LOOMBUS_GOLD = "#d6a84f";
const ATTACHMENT_BUCKET = "discussion-attachments";
const AUTOSAVE_DELAY_MS = 1400;

const MODE_OPTIONS: ModeOption[] = [
  {
    key: "open_discussion",
    label: "Open Discussion",
    shortLabel: "Open-ended conversation",
    description: "Start a focused conversation around a clear topic.",
    Icon: MessageSquare,
  },
  {
    key: "debate",
    label: "Debate",
    shortLabel: "Two sides, respectfully",
    description: "Frame opposing positions so replies compare reasoning directly.",
    Icon: Scale,
  },
  {
    key: "research_question",
    label: "Research Question",
    shortLabel: "Seek insights and evidence",
    description: "Ask for sources, patterns, and careful uncertainty.",
    Icon: Search,
  },
  {
    key: "problem_solving",
    label: "Problem Solving",
    shortLabel: "Find solutions together",
    description: "Define a practical problem and invite solution-oriented replies.",
    Icon: Puzzle,
  },
];

function isDiscussionMode(value: string | null | undefined): value is DiscussionMode {
  return MODE_OPTIONS.some((option) => option.key === value);
}

function getSelectableTopics() {
  return DISCUSSION_TOPICS.filter((topic) => topic.trim().toLowerCase() !== "other");
}

function getTagCount(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5).length;
}

function formatDraftTime(value: string | null) {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getSafeFileName(fileName: string) {
  return (
    fileName
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 120) || "attachment"
  );
}

function buildDraftBody({
  body,
  purpose,
  mode,
  tags,
}: {
  body: string;
  purpose: string;
  mode: DiscussionMode;
  tags: string;
}) {
  const metadataLines = [
    purpose.trim() ? `Purpose: ${purpose.trim()}` : "",
    mode ? `Mode: ${mode}` : "",
    tags.trim() ? `Tags: ${tags.trim()}` : "",
  ].filter(Boolean);

  return metadataLines.length > 0 ? `${metadataLines.join("\n")}\n\n${body}` : body;
}

function parseDraftBody(value: string | null | undefined) {
  const raw = value ?? "";
  const parts = raw.split(/\n\n/);
  const firstBlock = parts[0] ?? "";
  const rest = parts.slice(1).join("\n\n");
  const metadataLines = firstBlock.split("\n").filter((line) => line.trim().length > 0);
  const hasMetadata = metadataLines.length > 0 && metadataLines.every((line) => /^(Purpose|Mode|Tags):\s*/.test(line));

  if (!hasMetadata) {
    return { body: raw, purpose: "", mode: "open_discussion" as DiscussionMode, tags: "" };
  }

  const metadata: Record<string, string> = {};
  for (const line of metadataLines) {
    const [key, ...valueParts] = line.split(":");
    metadata[key.trim()] = valueParts.join(":").trim();
  }

  return {
    body: rest,
    purpose: metadata.Purpose ?? "",
    mode: isDiscussionMode(metadata.Mode) ? metadata.Mode : ("open_discussion" as DiscussionMode),
    tags: metadata.Tags ?? "",
  };
}

function buildQualityFindings({
  title,
  topic,
  purpose,
  body,
}: {
  title: string;
  topic: string;
  purpose: string;
  body: string;
}): Finding[] {
  const wordCount = body.trim() ? body.trim().replace(/\s+/g, " ").split(" ").length : 0;
  return [
    {
      label: "Clear title",
      done: title.trim().length >= 8,
      detail: title.trim().length >= 8 ? "The title gives readers a clear entry point." : "Use a specific title with at least 8 characters.",
    },
    {
      label: "Topic selected",
      done: topic.trim().length >= 2,
      detail: topic.trim().length >= 2 ? "A topic is selected for discovery." : "Choose one approved Loombus topic.",
    },
    {
      label: "Right mode selected",
      done: true,
      detail: "The discussion has a response frame.",
    },
    {
      label: "Useful body context",
      done: wordCount >= 25,
      detail: wordCount >= 25 ? "The body has enough context for meaningful replies." : "Add more background, stakes, or examples before review.",
    },
    {
      label: "Response intent",
      done: purpose.trim().length >= 8,
      detail: purpose.trim().length >= 8 ? "The purpose tells readers how to respond." : "Explain what you want others to clarify, solve, or debate.",
    },
  ];
}

function buildClaritySuggestion({
  title,
  topic,
  purpose,
  body,
}: {
  title: string;
  topic: string;
  purpose: string;
  body: string;
}) {
  return [
    title.trim() ? `Main point: ${title.trim()}` : "Main point: I want to start a focused discussion.",
    topic.trim() ? `Topic: ${topic.trim()}` : "",
    "",
    "Context:",
    body.trim() || "Add the background, situation, or question that people need before responding.",
    "",
    "What I want from the discussion:",
    purpose.trim() || "I want thoughtful replies that add clarity, useful examples, and practical insight.",
  ]
    .filter((section, index) => section !== "" || index === 2 || index === 5)
    .join("\n");
}

function isAllowedFile(file: File, kind: ContextKind) {
  const allowed = kind === "video" ? VIDEO_CONTEXT_ALLOWED_MIME_TYPES : NON_VIDEO_ATTACHMENT_MIME_TYPES;
  return (allowed as readonly string[]).includes(file.type);
}

export default function CreateV2ClientPage() {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [realityLens, setRealityLens] = useState("");
  const [purposeLane, setPurposeLane] = useState("");
  const [purpose, setPurpose] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [mode, setMode] = useState<DiscussionMode>("open_discussion");
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState("Loading draft...");
  const [publishing, setPublishing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPanel, setPickerPanel] = useState<PickerPanel>("topics");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [aiMessage, setAiMessage] = useState("");
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const [safetyWarning, setSafetyWarning] = useState<SafetyWarningState>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const selectedMode = MODE_OPTIONS.find((option) => option.key === mode) ?? MODE_OPTIONS[0];
  const tagCount = getTagCount(tags);
  const options = pickerPanel === "topics" ? getSelectableTopics() : pickerPanel === "reality" ? REALITY_LENSES : PURPOSE_LANES;
  const draftFingerprint = useMemo(
    () => JSON.stringify({ title, topic, realityLens, purposeLane, purpose, body, tags, mode }),
    [body, mode, purpose, purposeLane, realityLens, tags, title, topic]
  );
  const hasDraftContent = useMemo(
    () => Boolean(title.trim() || topic.trim() || realityLens.trim() || purposeLane.trim() || purpose.trim() || body.trim() || tags.trim() || mode !== "open_discussion"),
    [body, mode, purpose, purposeLane, realityLens, tags, title, topic]
  );
  const readiness = useMemo(() => {
    const checks = [
      { label: "Choose a clear title", done: title.trim().length >= 8 },
      { label: "Select the right topic", done: topic.trim().length >= 2 },
      { label: "Select the right mode", done: Boolean(mode) },
      { label: "Add useful context", done: body.trim().length >= 40 },
      { label: "Invite meaningful responses", done: purpose.trim().length >= 8 || purposeLane.trim().length > 0 },
    ];
    const completed = checks.filter((check) => check.done).length;
    return { checks, completed, total: checks.length, percent: Math.round((completed / checks.length) * 100) };
  }, [body, mode, purpose, purposeLane, title, topic]);

  useEffect(() => {
    async function loadLatestDraft() {
      setDraftHydrated(false);
      setAutosaveStatus("Loading draft...");
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setDraftHydrated(true);
        setAutosaveStatus("Sign in required");
        return;
      }

      try {
        const response = await fetch("/api/discussion-drafts", {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          setAutosaveStatus("Draft storage unavailable");
          setDraftHydrated(true);
          return;
        }

        const draft = result.draft as DraftRow | null;
        if (!draft) {
          setDraftHydrated(true);
          setAutosaveStatus("Ready to autosave");
          return;
        }

        const parsed = parseDraftBody(draft.body);
        setDraftId(draft.id);
        setDraftSavedAt(draft.updated_at);
        setTitle(draft.title ?? "");
        setTopic(draft.topic ?? "");
        setRealityLens(draft.reality_lens ?? "");
        setPurposeLane(draft.purpose_lane ?? "");
        setPurpose(parsed.purpose);
        setMode(parsed.mode);
        setTags(parsed.tags);
        setBody(parsed.body);
        setAutosaveStatus("Draft loaded");
        setDraftHydrated(true);
      } catch {
        setAutosaveStatus("Autosave unavailable");
        setDraftHydrated(true);
      }
    }

    void loadLatestDraft();
  }, []);

  useEffect(() => {
    if (!draftHydrated || !hasDraftContent || publishing) return;
    setAutosaveStatus("Autosave pending...");
    const timer = window.setTimeout(() => {
      void saveDraft({ manual: false });
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draftFingerprint, draftHydrated, hasDraftContent, publishing]);

  function runQualityCheck() {
    const nextFindings = buildQualityFindings({ title, topic, purpose, body });
    setFindings(nextFindings);
    setAiMessage(`Discussion quality check complete: ${nextFindings.filter((finding) => finding.done).length} of ${nextFindings.length} checks are ready.`);
  }

  function runClaritySuggestions() {
    const suggestion = buildClaritySuggestion({ title, topic, purpose, body });
    setFindings(buildQualityFindings({ title, topic, purpose, body: suggestion }));
    setAiMessage(`Clarity suggestion:\n\n${suggestion}`);
  }

  function addSupportingContext(event: ChangeEvent<HTMLInputElement>, kind: ContextKind) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    if (contextItems.length + files.length > MAX_DISCUSSION_ATTACHMENTS) {
      setAttachmentMessage(`You can attach up to ${MAX_DISCUSSION_ATTACHMENTS} files.`);
      event.target.value = "";
      return;
    }

    const invalidFile = files.find((file) => !isAllowedFile(file, kind));
    if (invalidFile) {
      setAttachmentMessage(kind === "video" ? "Video Context must be MP4, MOV, or WebM." : "Attachments must be images or PDFs.");
      event.target.value = "";
      return;
    }

    const invalidSizeFile = files.find((file) => kind !== "video" && file.size > NON_VIDEO_ATTACHMENT_MAX_SIZE_BYTES);
    if (invalidSizeFile) {
      setAttachmentMessage("Images and PDFs must be 10 MB or less.");
      event.target.value = "";
      return;
    }

    const nextItems = files.map((file) => ({
      id: `${kind}-${file.name}-${file.size}-${file.lastModified}`,
      file,
      kind,
    }));
    setContextItems((items) =>
      [...items, ...nextItems]
        .filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index)
        .slice(0, MAX_DISCUSSION_ATTACHMENTS)
    );
    setAttachmentMessage(`${files.length} ${kind === "video" ? "video" : "file"}${files.length === 1 ? "" : "s"} staged.`);
    event.target.value = "";
  }

  async function saveDraft({ manual = true }: { manual?: boolean } = {}) {
    setDraftLoading(true);
    if (manual) setMessage("");
    setAutosaveStatus(manual ? "Saving draft..." : "Autosaving...");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      window.location.href = "/login";
      return false;
    }

    try {
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
          body: buildDraftBody({ body, purpose, mode, tags }),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAutosaveStatus(manual ? "Draft not saved" : "Autosave failed");
        if (manual) setMessage(result.error ?? "Unable to save draft.");
        return false;
      }
      const savedDraft = result.draft as { id: string; updated_at: string };
      setDraftId(savedDraft.id);
      setDraftSavedAt(savedDraft.updated_at);
      setAutosaveStatus(manual ? "Draft saved" : "Autosaved");
      if (manual) setMessage("Draft saved.");
      return true;
    } finally {
      setDraftLoading(false);
    }
  }

  function clearDraft() {
    setTitle("");
    setTopic("");
    setRealityLens("");
    setPurposeLane("");
    setPurpose("");
    setBody("");
    setTags("");
    setMode("open_discussion");
    setContextItems([]);
    setFindings([]);
    setAiMessage("");
    setDraftId(null);
    setDraftSavedAt(null);
    setMessage("Draft cleared locally.");
    setAutosaveStatus("Ready to autosave");
  }

  async function reviewDraft() {
    if (!hasDraftContent) {
      setMessage("Add a title or body before reviewing a draft.");
      return;
    }
    const saved = await saveDraft({ manual: false });
    if (saved) window.location.href = "/create/review";
  }

  async function copyDraft() {
    const draftText = [
      title.trim() ? `Title: ${title.trim()}` : "Title: Untitled discussion",
      topic.trim() ? `Topic: ${topic.trim()}` : "Topic: Not selected",
      realityLens.trim() ? `Reality Lens: ${realityLens.trim()}` : null,
      purposeLane.trim() ? `Purpose Lane: ${purposeLane.trim()}` : null,
      `Mode: ${selectedMode.label}`,
      purpose.trim() ? `Purpose: ${purpose.trim()}` : null,
      tags.trim() ? `Tags: ${tags.trim()}` : null,
      "",
      body.trim(),
    ]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard.writeText(draftText);
    setCopyMessage("Draft copied.");
  }

  async function uploadContext({ discussionId, accessToken, userId }: { discussionId: string; accessToken: string; userId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
    for (const [index, item] of contextItems.entries()) {
      const extension = getSafeFileName(item.file.name).split(".").pop() || "file";
      const storagePath = `${userId}/${discussionId}/${crypto.randomUUID()}.${extension}`;
      const attachmentKind = getAttachmentKindForMimeType(item.file.type);
      if (!attachmentKind) return { ok: false, error: "Attachment type is not allowed." };

      const { error: uploadError } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(storagePath, item.file, {
        contentType: item.file.type,
        upsert: false,
      });
      if (uploadError) return { ok: false, error: `Discussion was saved, but ${item.file.name} could not upload: ${uploadError.message}` };

      const { data: publicUrlData } = supabase.storage.from(ATTACHMENT_BUCKET).getPublicUrl(storagePath);
      const response = await fetch("/api/discussions/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          discussionId,
          storagePath,
          publicUrl: publicUrlData.publicUrl,
          fileName: item.file.name,
          mimeType: item.file.type,
          fileSizeBytes: item.file.size,
          sortOrder: index,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
        return { ok: false, error: result.error ?? `Discussion was saved, but ${item.file.name} could not be attached.` };
      }
    }
    return { ok: true };
  }

  async function publishDiscussion(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (publishing) return;
    setPublishing(true);
    setMessage("");
    setSafetyWarning(null);

    if (!title.trim()) {
      setMessage("Please enter a discussion title.");
      setPublishing(false);
      return;
    }
    if (!topic.trim()) {
      setMessage("Choose a topic before publishing.");
      setPublishing(false);
      return;
    }
    if (topic === "Other" && !realityLens && !purposeLane) {
      setMessage("Choose a Reality Lens or Purpose Lane when Topic is Other.");
      setPublishing(false);
      return;
    }
    if (!body.trim()) {
      setMessage("Please enter discussion content.");
      setPublishing(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/discussions/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        title,
        topic,
        realityLens,
        purposeLane,
        discussionType: mode,
        discussionMetadata: {
          purpose: purpose.trim(),
          realityLens: realityLens.trim(),
          purposeLane: purposeLane.trim(),
          framing: mode,
        },
        body,
        tags,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const safetyWarningResult = getSafetyWarningFromResult(result);
      if (safetyWarningResult) {
        setSafetyWarning(safetyWarningResult);
      } else {
        setMessage(result.error ?? "Unable to publish discussion.");
      }
      setPublishing(false);
      return;
    }

    const discussionId = result.discussion?.id as string | undefined;
    if (!discussionId) {
      setMessage("Discussion was created, but Loombus could not open it automatically.");
      setPublishing(false);
      return;
    }

    if (contextItems.length > 0) {
      const uploadResult = await uploadContext({ discussionId, accessToken: session.access_token, userId: session.user.id });
      if (!uploadResult.ok) {
        setMessage(uploadResult.error);
        setPublishing(false);
        return;
      }
    }

    if (draftId) {
      await fetch("/api/discussion-drafts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ draftId }),
      });
    }

    window.location.href = `/discussions/${discussionId}`;
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <SafetyWarningModal warning={safetyWarning} onClose={() => setSafetyWarning(null)} />
      <section className="mx-auto max-w-7xl">
        <header className="mb-5">
          <h1 className="text-3xl font-black tracking-tight text-[var(--loombus-text)] sm:text-4xl">Create Discussion</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">Start a meaningful conversation. Give your community something worth discussing.</p>
        </header>

        <form onSubmit={publishDiscussion} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm sm:p-6">
              <div className="grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--loombus-text-muted)]">Discussion Title <span className="text-red-500">*</span></span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g., The future of decentralized identity" className="w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-sm text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/50" />
                  <p className="mt-2 text-xs font-medium text-[var(--loombus-text-muted)]">Be clear, specific, and engaging.</p>
                </label>

                <div className="relative">
                  <span className="mb-2 block text-sm font-bold text-[var(--loombus-text-muted)]">Topic <span className="text-red-500">*</span></span>
                  <button type="button" onClick={() => { setPickerPanel("topics"); setPickerOpen((current) => !current); }} className="flex w-full items-center gap-3 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-left text-sm text-[var(--loombus-text)] shadow-sm transition hover:border-amber-300 hover:bg-amber-50/50">
                    <Plus className="size-5 text-amber-700" />
                    <span className={topic ? "font-bold" : "text-[var(--loombus-text-subtle)]"}>{topic || "Choose an approved topic"}</span>
                  </button>
                  {pickerOpen && (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-3 shadow-2xl shadow-slate-950/15">
                      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                        <button type="button" onClick={() => setPickerPanel("topics")} className={`rounded-full px-3 py-2 text-xs font-black ${pickerPanel === "topics" ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]" : "bg-[var(--loombus-surface-muted)] text-[var(--loombus-text-muted)]"}`}>Topics</button>
                        <button type="button" onClick={() => setPickerPanel("reality")} className={`rounded-full px-3 py-2 text-xs font-black ${pickerPanel === "reality" ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]" : "bg-[var(--loombus-surface-muted)] text-[var(--loombus-text-muted)]"}`}>Reality Lens</button>
                        <button type="button" onClick={() => setPickerPanel("purpose")} className={`rounded-full px-3 py-2 text-xs font-black ${pickerPanel === "purpose" ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]" : "bg-[var(--loombus-surface-muted)] text-[var(--loombus-text-muted)]"}`}>Purpose Lane</button>
                      </div>
                      {pickerPanel === "topics" && <button type="button" onClick={() => { setTopic("Other"); setPickerPanel("reality"); }} className="mb-3 w-full rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm font-black text-amber-900">Other — choose a Reality Lens and Purpose Lane instead</button>}
                      <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                        {options.map((option) => <button key={option} type="button" onClick={() => { if (pickerPanel === "topics") { setTopic(option); setPickerOpen(false); } else if (pickerPanel === "reality") { setRealityLens(option); setPickerPanel("purpose"); } else { setPurposeLane(option); setPickerOpen(false); } }} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-2 text-left text-sm font-bold text-[var(--loombus-text-muted)] transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900">{option}</button>)}
                      </div>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">{realityLens && <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">Reality Lens: {realityLens}</span>}{purposeLane && <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Purpose Lane: {purposeLane}</span>}</div>
                  <p className="mt-2 text-xs font-medium text-[var(--loombus-text-muted)]">Use the plus menu to choose a topic. Use Other only to choose Reality Lens and Purpose Lane.</p>
                </div>

                <div>
                  <p className="mb-3 text-sm font-bold text-[var(--loombus-text-muted)]">Discussion Mode <span className="text-red-500">*</span></p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {MODE_OPTIONS.map((option) => {
                      const Icon = option.Icon;
                      const selected = mode === option.key;
                      return <button key={option.key} type="button" onClick={() => setMode(option.key)} className={`rounded-2xl border p-4 text-center transition ${selected ? "border-amber-400 bg-amber-50 text-amber-950 shadow-sm ring-2 ring-amber-100" : "border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] text-[var(--loombus-text)] hover:border-amber-200 hover:bg-amber-50/50"}`}><Icon className={`mx-auto size-7 ${selected ? "text-amber-700" : "text-[var(--loombus-text)]"}`} /><span className="mt-3 block text-sm font-black">{option.label}</span><span className="mt-1 block text-xs leading-5 opacity-75">{option.shortLabel}</span></button>;
                    })}
                  </div>
                </div>

                <label className="block"><span className="mb-2 block text-sm font-bold text-[var(--loombus-text-muted)]">Discussion Purpose <span className="text-red-500">*</span></span><input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="What do you hope to achieve with this discussion?" className="w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-sm text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/50" /><p className="mt-2 text-xs font-medium text-[var(--loombus-text-muted)]">Define your intent to guide better responses.</p></label>
                <label className="block"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-bold text-[var(--loombus-text-muted)]">Body <span className="text-red-500">*</span></span><span className="text-xs font-semibold text-[var(--loombus-text-subtle)]">{body.length}/3000</span></div><textarea value={body} onChange={(event) => setBody(event.target.value.slice(0, 3000))} placeholder="Provide context, background, or details for your discussion..." rows={8} className="w-full resize-y rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/50" /><p className="mt-2 text-xs font-medium text-[var(--loombus-text-muted)]">The more context you provide, the better the conversation.</p></label>

                <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-amber-950"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-black"><Brain className="size-4" />AI draft tools</h2><p className="mt-1 text-xs font-semibold leading-5">Check discussion quality or get AI clarity suggestions before review. Suggestions never replace your typed body.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={runQualityCheck} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-amber-800 shadow-sm ring-1 ring-amber-100"><Sparkles className="size-4" />Discussion quality check</button><button type="button" onClick={runClaritySuggestions} className="inline-flex items-center gap-2 rounded-xl bg-[#d6a84f] px-3 py-2 text-xs font-black text-slate-950 shadow-sm"><WandSparkles className="size-4" />Clarity suggestions</button></div></div>{aiMessage && <p className="mt-3 whitespace-pre-wrap text-xs font-bold leading-5 text-amber-950">{aiMessage}</p>}{findings.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{findings.map((finding) => <div key={finding.label} className="rounded-xl bg-white px-3 py-2 text-xs shadow-sm ring-1 ring-amber-100"><p className={`flex items-center gap-2 font-black ${finding.done ? "text-emerald-700" : "text-amber-700"}`}>{finding.done ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}{finding.label}</p><p className="mt-1 leading-5 text-slate-600">{finding.detail}</p></div>)}</div>}</section>
                <label className="block"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-bold text-[var(--loombus-text-muted)]">Tags</span><span className="text-xs font-semibold text-[var(--loombus-text-subtle)]">{tagCount}/5</span></div><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Add up to 5 tags, e.g., web3, governance, identity" className="w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-sm text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/50" /><p className="mt-2 text-xs font-medium text-[var(--loombus-text-muted)]">Tags help others discover your discussion.</p></label>
              </div>
            </section>

            <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm sm:p-6"><p className="text-sm font-black text-[var(--loombus-text)]">Attach supporting context <span className="font-medium text-[var(--loombus-text-muted)]">(optional)</span></p><p className="mt-1 text-xs font-medium text-[var(--loombus-text-muted)]">Attach files or video context to support the draft setup.</p><input ref={fileInputRef} type="file" multiple accept={DISCUSSION_ATTACHMENT_ACCEPT} className="hidden" onChange={(event) => addSupportingContext(event, "file")} /><input ref={videoInputRef} type="file" multiple accept="video/*" className="hidden" onChange={(event) => addSupportingContext(event, "video")} /><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4 text-left transition hover:border-amber-300 hover:bg-amber-50/50"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Paperclip className="size-5" /></span><div><p className="text-sm font-black text-[var(--loombus-text)]">Attach Files</p><p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">Images, PDFs, text, or documents.</p></div></div></button><button type="button" onClick={() => videoInputRef.current?.click()} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4 text-left transition hover:border-amber-300 hover:bg-amber-50/50"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Mic className="size-5" /></span><div><p className="text-sm font-black text-[var(--loombus-text)]">Video Context</p><p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">Select a video file to stage with the draft.</p></div></div></button></div>{contextItems.length > 0 && <div className="mt-4 space-y-2">{contextItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-2 text-sm"><div className="min-w-0"><p className="truncate font-black text-[var(--loombus-text)]">{item.file.name}</p><p className="text-xs font-semibold text-[var(--loombus-text-subtle)]">{item.kind === "video" || isVideoContextMimeType(item.file.type) ? "Video" : "File"} · {formatFileSize(item.file.size)}</p></div><button type="button" onClick={() => setContextItems((items) => items.filter((candidate) => candidate.id !== item.id))} className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--loombus-text-muted)] transition hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${item.file.name}`}><X className="size-4" /></button></div>)}</div>}{(attachmentMessage || message) && <p className="mt-4 text-sm font-semibold text-[var(--loombus-text-muted)]">{attachmentMessage || message}</p>}<div className="mt-5 flex flex-col gap-3 border-t border-[var(--loombus-border)] pt-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-3"><button type="button" onClick={() => saveDraft({ manual: true })} disabled={draftLoading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-2 text-sm font-bold text-amber-800 shadow-sm"><Save className="size-4" />{draftLoading ? "Saving..." : "Save Draft"}</button><button type="button" onClick={clearDraft} disabled={draftLoading || publishing} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-2 text-sm font-bold text-[var(--loombus-text-muted)] shadow-sm"><Trash2 className="size-4" />Clear</button></div><div className="flex flex-wrap gap-3"><button type="button" onClick={reviewDraft} disabled={draftLoading || publishing} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-2 text-sm font-bold text-[var(--loombus-text)] shadow-sm"><Send className="size-4" />Review draft</button><button type="submit" disabled={publishing} className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-2 text-sm font-black text-slate-950 shadow-sm disabled:opacity-60" style={{ backgroundColor: LOOMBUS_GOLD }}><Send className="size-4" />{publishing ? "Publishing..." : "Publish"}</button></div></div></section>
          </div>

          <aside className="space-y-4"><section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm"><h2 className="text-lg font-black text-[var(--loombus-text)]">Create with clarity</h2><p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">A great discussion starts with a clear setup.</p><div className="mt-5 space-y-5">{readiness.checks.map((check, index) => <div key={check.label} className="flex gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${check.done ? "text-slate-950" : "bg-amber-50 text-amber-800"}`} style={check.done ? { backgroundColor: LOOMBUS_GOLD } : undefined}>{index + 1}</span><div><p className="text-sm font-black text-[var(--loombus-text)]">{check.label}</p><p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">{check.done ? "Ready" : "Needs attention before review"}</p></div></div>)}</div><div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--loombus-surface-muted)]"><div className="h-full rounded-full" style={{ width: `${readiness.percent}%`, backgroundColor: LOOMBUS_GOLD }} /></div><p className="mt-3 text-xs font-semibold text-[var(--loombus-text-muted)]">{readiness.completed} of {readiness.total} checks complete.</p></section><section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm"><div className="flex items-center gap-3"><Save className="size-5 text-amber-700" /><h2 className="font-black text-[var(--loombus-text)]">Private draft</h2></div><p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">{autosaveStatus}</p><p className="mt-2 text-xs font-semibold text-[var(--loombus-text-subtle)]">Last saved: {formatDraftTime(draftSavedAt)}</p></section><section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm"><ShieldCheck className="mb-4 size-5 text-amber-700" /><div className="flex flex-col gap-3"><button type="button" onClick={copyDraft} className="rounded-2xl border border-[var(--loombus-border)] px-4 py-2 text-sm font-black text-amber-800 transition hover:border-amber-300 hover:bg-amber-50">Copy draft</button><button type="button" onClick={reviewDraft} disabled={draftLoading || publishing} className="rounded-2xl border border-[var(--loombus-border)] px-4 py-2 text-sm font-black text-[var(--loombus-text)] transition hover:border-amber-300 hover:bg-amber-50 disabled:opacity-60">Review draft</button><button type="submit" disabled={publishing} className="rounded-2xl px-4 py-2 text-center text-sm font-black text-slate-950 disabled:opacity-60" style={{ backgroundColor: LOOMBUS_GOLD }}>{publishing ? "Publishing..." : "Publish"}</button></div>{copyMessage && <p className="mt-3 text-xs leading-5 text-[var(--loombus-text-muted)]">{copyMessage}</p>}</section><section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm"><div className="flex items-center gap-3"><FileText className="size-5 text-amber-700" /><h2 className="font-black text-[var(--loombus-text)]">Selected framing</h2></div><p className="mt-3 text-sm font-bold text-[var(--loombus-text)]">{selectedMode.label}</p><p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{selectedMode.description}</p><div className="mt-4 space-y-2 text-xs font-semibold text-[var(--loombus-text-muted)]"><p>Topic: {topic || "Not selected"}</p><p>Reality Lens: {realityLens || "Not selected"}</p><p>Purpose Lane: {purposeLane || "Not selected"}</p><p>Supporting context: {contextItems.length > 0 ? `${contextItems.length} staged` : "None staged"}</p></div></section></aside>
        </form>
      </section>
    </main>
  );
}
