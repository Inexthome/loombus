"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  Brain,
  CheckCircle2,
  Circle,
  Copy,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Mic,
  Puzzle,
  Save,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
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

type DiscussionMode =
  | "open_discussion"
  | "debate"
  | "research_question"
  | "problem_solving";
type PickerPanel = "topics" | "reality" | "purpose";
type ContextKind = "file" | "video";
type ComposerPanel = "topic" | "mode" | "add" | "guidance" | "more" | null;
type ComposerVariant = "page" | "modal";

type ModeOption = {
  key: DiscussionMode;
  label: string;
  shortLabel: string;
  description: string;
  Icon: LucideIcon;
  purposeLabel: string;
  purposePlaceholder: string;
  purposeHelp: string;
  bodyPlaceholder: string;
  bodyHelp: string;
  prompts: string[];
  template: string;
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

type AudiencePreference = {
  default_audience_type: string | null;
};

const LOOMBUS_GOLD = "#d6a84f";
const ATTACHMENT_BUCKET = "discussion-attachments";
const AUTOSAVE_DELAY_MS = 1400;
const LOCAL_CREATE_DRAFT_KEY = "loombus:create:v2-local-draft";

const MODE_OPTIONS: ModeOption[] = [
  {
    key: "open_discussion",
    label: "Open Discussion",
    shortLabel: "Open-ended conversation",
    description: "Start a focused conversation around a clear topic.",
    Icon: MessageSquare,
    purposeLabel: "Discussion Purpose",
    purposePlaceholder: "What should members explore, clarify, or contribute?",
    purposeHelp: "Explain the kind of thoughtful response you want from the community.",
    bodyPlaceholder:
      "Provide the background, explain why the subject matters, and state the main question you want members to discuss.",
    bodyHelp: "Include context, stakes, examples, and the main question.",
    prompts: ["Relevant context", "Why it matters", "Main question or invitation"],
    template: "Context:\n\nWhy this matters:\n\nQuestion for the community:\n",
  },
  {
    key: "debate",
    label: "Debate",
    shortLabel: "Two sides, respectfully",
    description: "Frame opposing positions so replies compare reasoning directly.",
    Icon: Scale,
    purposeLabel: "Debate Goal",
    purposePlaceholder: "What should the debate clarify or test?",
    purposeHelp: "State what a productive comparison of the two positions should accomplish.",
    bodyPlaceholder:
      "State the central claim, explain Position A and Position B fairly, and identify the evidence or reasoning members should examine.",
    bodyHelp: "Avoid framing one side as obviously correct before the discussion begins.",
    prompts: ["Central claim", "Position A", "Position B", "Evidence requested"],
    template:
      "Central claim:\n\nPosition A:\n\nPosition B:\n\nEvidence or reasoning requested:\n",
  },
  {
    key: "research_question",
    label: "Research Question",
    shortLabel: "Seek insights and evidence",
    description: "Ask for sources, patterns, and careful uncertainty.",
    Icon: Search,
    purposeLabel: "Research Goal",
    purposePlaceholder: "What should the research discussion help establish?",
    purposeHelp: "Describe the knowledge gap or uncertainty you want members to investigate.",
    bodyPlaceholder:
      "State the research question, summarize what is already known, include relevant sources, and explain what remains unresolved.",
    bodyHelp: "Distinguish evidence, assumptions, and open questions.",
    prompts: [
      "Research question",
      "What is already known",
      "Sources or evidence",
      "What remains unresolved",
    ],
    template:
      "Research question:\n\nWhat is already known:\n\nSources or evidence:\n\nWhat remains unresolved:\n",
  },
  {
    key: "problem_solving",
    label: "Problem Solving",
    shortLabel: "Find solutions together",
    description: "Define a practical problem and invite solution-oriented replies.",
    Icon: Puzzle,
    purposeLabel: "Desired Outcome",
    purposePlaceholder: "What useful result should this discussion produce?",
    purposeHelp:
      "Describe the decision, solution, or next step you hope the community can help identify.",
    bodyPlaceholder:
      "Define the problem, list attempted solutions, explain the constraints, and describe the outcome you need.",
    bodyHelp: "Concrete constraints help members propose realistic solutions.",
    prompts: ["Problem", "What has been attempted", "Constraints", "Desired outcome"],
    template:
      "Problem:\n\nWhat has been attempted:\n\nConstraints:\n\nDesired outcome:\n",
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
  const hasMetadata =
    metadataLines.length > 0 &&
    metadataLines.every((line) => /^(Purpose|Mode|Tags):\s*/.test(line));

  if (!hasMetadata) {
    return {
      body: raw,
      purpose: "",
      mode: "open_discussion" as DiscussionMode,
      tags: "",
    };
  }

  const metadata: Record<string, string> = {};
  for (const line of metadataLines) {
    const [key, ...valueParts] = line.split(":");
    metadata[key.trim()] = valueParts.join(":").trim();
  }

  return {
    body: rest,
    purpose: metadata.Purpose ?? "",
    mode: isDiscussionMode(metadata.Mode)
      ? metadata.Mode
      : ("open_discussion" as DiscussionMode),
    tags: metadata.Tags ?? "",
  };
}

function readLocalDraft(): DraftRow | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LOCAL_CREATE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftRow;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      id: parsed.id || "local-create-draft",
      title: parsed.title ?? "",
      topic: parsed.topic ?? "",
      reality_lens: parsed.reality_lens ?? "",
      purpose_lane: parsed.purpose_lane ?? "",
      body: parsed.body ?? "",
      updated_at: parsed.updated_at ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeLocalDraft(
  draft: Omit<DraftRow, "id" | "updated_at"> & {
    id?: string | null;
    updated_at?: string | null;
  }
) {
  const nextDraft: DraftRow = {
    id: draft.id || "local-create-draft",
    title: draft.title ?? "",
    topic: draft.topic ?? "",
    reality_lens: draft.reality_lens ?? "",
    purpose_lane: draft.purpose_lane ?? "",
    body: draft.body ?? "",
    updated_at: draft.updated_at ?? new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCAL_CREATE_DRAFT_KEY, JSON.stringify(nextDraft));
  }

  return nextDraft;
}

function clearLocalDraft() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LOCAL_CREATE_DRAFT_KEY);
  }
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
  const wordCount = body.trim()
    ? body.trim().replace(/\s+/g, " ").split(" ").length
    : 0;

  return [
    {
      label: "Clear title",
      done: title.trim().length >= 8,
      detail:
        title.trim().length >= 8
          ? "The title gives readers a clear entry point."
          : "Use a specific title with at least 8 characters.",
    },
    {
      label: "Topic selected",
      done: topic.trim().length >= 2,
      detail:
        topic.trim().length >= 2
          ? "A topic is selected for discovery."
          : "Choose one approved Loombus topic.",
    },
    {
      label: "Right mode selected",
      done: true,
      detail: "The discussion has a response frame.",
    },
    {
      label: "Useful body context",
      done: wordCount >= 25,
      detail:
        wordCount >= 25
          ? "The body has enough context for meaningful replies."
          : "Add more background, stakes, or examples before review.",
    },
    {
      label: "Response intent",
      done: purpose.trim().length >= 8,
      detail:
        purpose.trim().length >= 8
          ? "The purpose tells readers how to respond."
          : "Explain what you want others to clarify, solve, or debate.",
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
    title.trim()
      ? `Main point: ${title.trim()}`
      : "Main point: I want to start a focused discussion.",
    topic.trim() ? `Topic: ${topic.trim()}` : "",
    "",
    "Context:",
    body.trim() ||
      "Add the background, situation, or question that people need before responding.",
    "",
    "What I want from the discussion:",
    purpose.trim() ||
      "I want thoughtful replies that add clarity, useful examples, and practical insight.",
  ]
    .filter((section, index) => section !== "" || index === 2 || index === 5)
    .join("\n");
}

function isAllowedFile(file: File, kind: ContextKind) {
  const allowed =
    kind === "video" ? VIDEO_CONTEXT_ALLOWED_MIME_TYPES : NON_VIDEO_ATTACHMENT_MIME_TYPES;
  return (allowed as readonly string[]).includes(file.type);
}

function getStatusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("saving") || normalized.includes("pending")) return "Saving";
  if (normalized.includes("local")) return "Local";
  if (normalized.includes("sign in")) return "Local";
  if (normalized.includes("loaded")) return "Loaded";
  if (normalized.includes("saved") || normalized.includes("ready")) return "Saved";
  return "Draft";
}

function getTopicChipLabel({
  topic,
  realityLens,
  purposeLane,
}: {
  topic: string;
  realityLens: string;
  purposeLane: string;
}) {
  if (topic === "Other") return realityLens || purposeLane || "Other";
  return topic || "Topic";
}

function PanelShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close composer options"
        onClick={onClose}
      />
      <section className="relative z-10 flex max-h-[86dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text)] shadow-2xl sm:rounded-[2rem]">
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--loombus-border)] px-5 py-4">
          <h2 className="text-lg font-black">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] text-[var(--loombus-text-muted)]"
            aria-label={`Close ${title}`}
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </section>
    </div>
  );
}

export default function CreateDiscussionComposer({
  variant = "page",
  onClose,
}: {
  variant?: ComposerVariant;
  onClose?: () => void;
}) {
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
  const [pickerPanel, setPickerPanel] = useState<PickerPanel>("topics");
  const [activePanel, setActivePanel] = useState<ComposerPanel>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [aiMessage, setAiMessage] = useState("");
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const [attachmentsRestricted, setAttachmentsRestricted] = useState(false);
  const [safetyWarning, setSafetyWarning] = useState<SafetyWarningState>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const selectedMode = MODE_OPTIONS.find((option) => option.key === mode) ?? MODE_OPTIONS[0];
  const tagCount = getTagCount(tags);
  const topicOptions =
    pickerPanel === "topics"
      ? getSelectableTopics()
      : pickerPanel === "reality"
        ? REALITY_LENSES
        : PURPOSE_LANES;
  const draftFingerprint = useMemo(
    () => JSON.stringify({ title, topic, realityLens, purposeLane, purpose, body, tags, mode }),
    [body, mode, purpose, purposeLane, realityLens, tags, title, topic]
  );
  const hasDraftContent = useMemo(
    () =>
      Boolean(
        title.trim() ||
          topic.trim() ||
          realityLens.trim() ||
          purposeLane.trim() ||
          purpose.trim() ||
          body.trim() ||
          tags.trim() ||
          mode !== "open_discussion"
      ),
    [body, mode, purpose, purposeLane, realityLens, tags, title, topic]
  );
  const readiness = useMemo(() => {
    const checks = [
      { label: "Choose a clear title", done: title.trim().length >= 8 },
      { label: "Select the right topic", done: topic.trim().length >= 2 },
      { label: "Select the right mode", done: Boolean(mode) },
      { label: "Add useful context", done: body.trim().length >= 40 },
      {
        label: "Invite meaningful responses",
        done: purpose.trim().length >= 8 || purposeLane.trim().length > 0,
      },
    ];
    const completed = checks.filter((check) => check.done).length;
    return {
      checks,
      completed,
      total: checks.length,
      percent: Math.round((completed / checks.length) * 100),
    };
  }, [body, mode, purpose, purposeLane, title, topic]);

  function hydrateDraft(draft: DraftRow, status: string) {
    const parsed = parseDraftBody(draft.body);
    setDraftId(draft.id === "local-create-draft" ? null : draft.id);
    setDraftSavedAt(draft.updated_at);
    setTitle(draft.title ?? "");
    setTopic(draft.topic ?? "");
    setRealityLens(draft.reality_lens ?? "");
    setPurposeLane(draft.purpose_lane ?? "");
    setPurpose(parsed.purpose);
    setMode(parsed.mode);
    setTags(parsed.tags);
    setBody(parsed.body);
    setAutosaveStatus(status);
  }

  function saveLocalSnapshot() {
    return writeLocalDraft({
      id: draftId ?? "local-create-draft",
      title,
      topic,
      reality_lens: realityLens,
      purpose_lane: purposeLane,
      body: buildDraftBody({ body, purpose, mode, tags }),
    });
  }

  useEffect(() => {
    async function loadLatestDraft() {
      setDraftHydrated(false);
      setAutosaveStatus("Loading draft...");
      const localDraft = readLocalDraft();
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        if (localDraft) hydrateDraft(localDraft, "Local draft loaded");
        else setAutosaveStatus("Sign in required");
        setDraftHydrated(true);
        return;
      }

      try {
        const response = await fetch("/api/discussion-drafts", {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });
        const result = await response.json().catch(() => ({}));

        if (response.ok && result.draft) {
          hydrateDraft(result.draft as DraftRow, "Draft loaded");
          setDraftHydrated(true);
          return;
        }

        if (localDraft) {
          hydrateDraft(localDraft, "Local draft loaded");
          setDraftHydrated(true);
          return;
        }

        setAutosaveStatus(
          response.ok ? "Ready to autosave" : "Server draft unavailable. Local autosave ready."
        );
      } catch {
        if (localDraft) hydrateDraft(localDraft, "Local draft loaded");
        else setAutosaveStatus("Server draft unavailable. Local autosave ready.");
      } finally {
        setDraftHydrated(true);
      }
    }

    void loadLatestDraft();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAudiencePolicy() {
      const { data: userResult } = await supabase.auth.getUser();
      const user = userResult.user;
      if (!user || cancelled) {
        setAttachmentsRestricted(false);
        return;
      }

      const { data: capability, error: capabilityError } = await supabase.rpc(
        "get_discussion_audience_capability"
      );
      if (cancelled || capability !== true || capabilityError) {
        setAttachmentsRestricted(false);
        return;
      }

      const { data: preference } = await supabase
        .from("discussion_audience_preferences")
        .select("default_audience_type")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      const audienceType =
        (preference as AudiencePreference | null)?.default_audience_type ?? "public";
      setAttachmentsRestricted(audienceType !== "public");
    }

    function refreshPolicy() {
      if (document.visibilityState !== "hidden") void loadAudiencePolicy();
    }

    void loadAudiencePolicy();
    window.addEventListener("focus", refreshPolicy);
    document.addEventListener("visibilitychange", refreshPolicy);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshPolicy);
      document.removeEventListener("visibilitychange", refreshPolicy);
    };
  }, []);

  useEffect(() => {
    if (!draftHydrated || !hasDraftContent || publishing) return;
    setAutosaveStatus("Autosave pending...");
    const timer = window.setTimeout(() => {
      void saveDraft({ manual: false });
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draftFingerprint, draftHydrated, hasDraftContent, publishing]);

  useEffect(() => {
    if (!activePanel) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActivePanel(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePanel]);

  function runQualityCheck() {
    const nextFindings = buildQualityFindings({ title, topic, purpose, body });
    setFindings(nextFindings);
    setAiMessage(
      `Discussion quality check complete: ${nextFindings.filter((finding) => finding.done).length} of ${nextFindings.length} checks are ready.`
    );
  }

  function runClaritySuggestions() {
    const suggestion = buildClaritySuggestion({ title, topic, purpose, body });
    setFindings(buildQualityFindings({ title, topic, purpose, body: suggestion }));
    setAiMessage(`Clarity suggestion:\n\n${suggestion}`);
  }

  function addSupportingContext(event: ChangeEvent<HTMLInputElement>, kind: ContextKind) {
    const files = Array.from(event.target.files ?? []) as File[];
    if (files.length === 0) return;

    if (attachmentsRestricted) {
      setAttachmentMessage(
        "Attachments require Public visibility. Change Future Discussion visibility in Settings."
      );
      event.target.value = "";
      return;
    }

    if (contextItems.length + files.length > MAX_DISCUSSION_ATTACHMENTS) {
      setAttachmentMessage(`You can attach up to ${MAX_DISCUSSION_ATTACHMENTS} files.`);
      event.target.value = "";
      return;
    }

    const invalidFile = files.find((file) => !isAllowedFile(file, kind));
    if (invalidFile) {
      setAttachmentMessage(
        kind === "video"
          ? "Video Context must be MP4, MOV, or WebM."
          : "Attachments must be images or PDFs."
      );
      event.target.value = "";
      return;
    }

    const invalidSizeFile = files.find(
      (file) => kind !== "video" && file.size > NON_VIDEO_ATTACHMENT_MAX_SIZE_BYTES
    );
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
        .filter(
          (item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index
        )
        .slice(0, MAX_DISCUSSION_ATTACHMENTS)
    );
    setAttachmentMessage(
      `${files.length} ${kind === "video" ? "video" : "file"}${files.length === 1 ? "" : "s"} staged.`
    );
    event.target.value = "";
  }

  async function saveDraft({ manual = true }: { manual?: boolean } = {}) {
    const localDraft = saveLocalSnapshot();
    setDraftSavedAt(localDraft.updated_at);
    setDraftLoading(true);
    if (manual) setMessage("");
    setAutosaveStatus(manual ? "Saving draft..." : "Autosaving...");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setAutosaveStatus(manual ? "Draft saved locally" : "Autosaved locally");
      if (manual) setMessage("Draft saved locally. Sign in is required for server sync.");
      setDraftLoading(false);
      return true;
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
        setAutosaveStatus(manual ? "Draft saved locally" : "Autosaved locally");
        if (manual) setMessage("Draft saved locally. Server draft storage is unavailable.");
        return true;
      }

      const savedDraft = result.draft as { id: string; updated_at: string };
      setDraftId(savedDraft.id);
      setDraftSavedAt(savedDraft.updated_at);
      writeLocalDraft({
        id: savedDraft.id,
        title,
        topic,
        reality_lens: realityLens,
        purpose_lane: purposeLane,
        body: buildDraftBody({ body, purpose, mode, tags }),
        updated_at: savedDraft.updated_at,
      });
      setAutosaveStatus(manual ? "Draft saved" : "Autosaved");
      if (manual) setMessage("Draft saved.");
      return true;
    } catch {
      setAutosaveStatus(manual ? "Draft saved locally" : "Autosaved locally");
      if (manual) setMessage("Draft saved locally. Server draft storage is unavailable.");
      return true;
    } finally {
      setDraftLoading(false);
    }
  }

  async function clearDraft() {
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
    setMessage("Draft cleared locally.");
    setAutosaveStatus("Ready to autosave");
    clearLocalDraft();

    if (!draftId) {
      setDraftId(null);
      setDraftSavedAt(null);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (accessToken) {
      await fetch("/api/discussion-drafts", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ draftId }),
      }).catch(() => null);
    }

    setDraftId(null);
    setDraftSavedAt(null);
  }

  async function reviewDraft() {
    if (!hasDraftContent) {
      setMessage("Add a title or body before reviewing a draft.");
      return;
    }

    saveLocalSnapshot();
    await saveDraft({ manual: false });
    window.location.href = "/create/review";
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

  async function uploadContext({
    discussionId,
    accessToken,
    userId,
  }: {
    discussionId: string;
    accessToken: string;
    userId: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    for (const [index, item] of contextItems.entries()) {
      const extension = getSafeFileName(item.file.name).split(".").pop() || "file";
      const storagePath = `${userId}/${discussionId}/${crypto.randomUUID()}.${extension}`;
      const attachmentKind = getAttachmentKindForMimeType(item.file.type);
      if (!attachmentKind) return { ok: false, error: "Attachment type is not allowed." };

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(storagePath, item.file, {
          contentType: item.file.type,
          upsert: false,
        });
      if (uploadError) {
        return {
          ok: false,
          error: `Discussion was saved, but ${item.file.name} could not upload: ${uploadError.message}`,
        };
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
          fileName: item.file.name,
          mimeType: item.file.type,
          fileSizeBytes: item.file.size,
          sortOrder: index,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
        return {
          ok: false,
          error:
            result.error ??
            `Discussion was saved, but ${item.file.name} could not be attached.`,
        };
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
    if (topic === "Other" && realityLens && purposeLane) {
      setMessage("Choose either a Reality Lens or a Purpose Lane, not both, when Topic is Other.");
      setPublishing(false);
      return;
    }
    if (!purpose.trim() && !purposeLane.trim()) {
      setMessage("Explain what you want members to explore, clarify, or contribute.");
      setPublishing(false);
      return;
    }
    if (!body.trim()) {
      setMessage("Please enter discussion content.");
      setPublishing(false);
      return;
    }
    if (attachmentsRestricted && contextItems.length > 0) {
      setMessage(
        "Remove staged attachments or change Future Discussion visibility to Public in Settings."
      );
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
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
      if (safetyWarningResult) setSafetyWarning(safetyWarningResult);
      else setMessage(result.error ?? "Unable to publish discussion.");
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
      const uploadResult = await uploadContext({
        discussionId,
        accessToken: session.access_token,
        userId: session.user.id,
      });
      if (!uploadResult.ok && "error" in uploadResult) {
        setMessage(uploadResult.error);
        setPublishing(false);
        return;
      }
    }

    clearLocalDraft();
    if (draftId) {
      await fetch("/api/discussion-drafts", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ draftId }),
      }).catch(() => null);
    }

    window.location.href = `/discussions/${discussionId}`;
  }

  function cancelComposer() {
    if (onClose) onClose();
    else window.location.href = "/discussions";
  }

  function chooseTopicOption(option: string) {
    if (pickerPanel === "topics") {
      setTopic(option);
      setActivePanel(null);
      return;
    }

    if (pickerPanel === "reality") {
      setRealityLens(option);
      if (topic === "Other") {
        setPurposeLane("");
        setActivePanel(null);
      } else {
        setPickerPanel("purpose");
      }
      return;
    }

    setPurposeLane(option);
    if (topic === "Other") setRealityLens("");
    setActivePanel(null);
  }

  const centerRail = (
    <div className="min-w-0 space-y-5">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-1 py-2">
        <button
          type="button"
          onClick={cancelComposer}
          className="justify-self-start text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]"
        >
          Cancel
        </button>
        <h1 className="text-center text-xl font-black tracking-tight text-[var(--loombus-text)] sm:text-2xl">
          Create Discussion
        </h1>
        <button
          type="button"
          onClick={() => void saveDraft({ manual: true })}
          className="justify-self-end text-sm font-black text-[#9a701c] dark:text-[#d6a84f]"
          title={autosaveStatus}
        >
          {getStatusLabel(autosaveStatus)}
        </button>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => {
            setPickerPanel("topics");
            setActivePanel("topic");
          }}
          className="min-h-14 truncate rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm font-black text-[var(--loombus-text)] transition hover:border-amber-300"
        >
          {getTopicChipLabel({ topic, realityLens, purposeLane })}
        </button>
        <button
          type="button"
          onClick={() => setActivePanel("mode")}
          className="min-h-14 truncate rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm font-black text-[var(--loombus-text)] transition hover:border-amber-300"
        >
          {selectedMode.label}
        </button>
        <button
          type="button"
          onClick={() => setActivePanel("add")}
          className="min-h-14 truncate rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm font-black text-[var(--loombus-text)] transition hover:border-amber-300"
        >
          {contextItems.length > 0 ? `Add · ${contextItems.length}` : "Add"}
        </button>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-sm">
        <label className="block border-b border-[var(--loombus-border)] p-5 sm:p-6">
          <span className="mb-3 block text-sm font-black text-[var(--loombus-text)]">
            Discussion Title <span className="text-red-500">*</span>
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g., The future of decentralized identity"
            className="min-h-14 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 text-base font-semibold text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20"
          />
          <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
            Be clear, specific, and engaging.
          </p>
        </label>

        <label className="block border-b border-[var(--loombus-border)] p-5 sm:p-6">
          <span className="mb-3 block text-sm font-black text-[var(--loombus-text)]">
            {selectedMode.purposeLabel} <span className="text-red-500">*</span>
          </span>
          <input
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            placeholder={selectedMode.purposePlaceholder}
            className="min-h-14 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 text-base text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20"
          />
          <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
            {selectedMode.purposeHelp}
          </p>
        </label>

        <label className="relative block p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm font-black text-[var(--loombus-text)]">
              Discussion Body <span className="text-red-500">*</span>
            </span>
            <span className="text-xs font-bold text-[var(--loombus-text-subtle)]">
              {body.length}/3000
            </span>
          </div>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, 3000))}
            placeholder={selectedMode.bodyPlaceholder}
            rows={12}
            className="min-h-[22rem] w-full resize-y rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-4 pr-16 text-base leading-7 text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20"
          />
          <button
            type="button"
            onClick={() => setActivePanel("guidance")}
            className="absolute bottom-[5.2rem] right-8 grid size-12 place-items-center rounded-full border border-amber-400/60 bg-[var(--loombus-surface-strong)] text-[#d6a84f] shadow-xl transition hover:scale-[1.03]"
            aria-label="Open Draft Guidance"
          >
            <Sparkles className="size-5" />
          </button>
          <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
            {selectedMode.bodyHelp}
          </p>
        </label>
      </section>

      {(message || attachmentMessage || copyMessage) && (
        <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm font-bold text-[var(--loombus-text-muted)]">
          {message || attachmentMessage || copyMessage}
        </div>
      )}

      <section className="grid grid-cols-[1fr_1fr_1.35fr] gap-2 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-3 shadow-sm sm:gap-3">
        <button
          type="button"
          onClick={() => setActivePanel("guidance")}
          className="min-h-14 rounded-2xl text-sm font-black text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)]"
        >
          Guidance
        </button>
        <button
          type="button"
          onClick={() => setActivePanel("more")}
          className="min-h-14 rounded-2xl text-sm font-black text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)]"
        >
          More
        </button>
        <button
          type="button"
          onClick={reviewDraft}
          disabled={draftLoading || publishing}
          className="min-h-14 rounded-2xl px-4 text-sm font-black text-[#17140c] shadow-sm disabled:opacity-60"
          style={{ backgroundColor: LOOMBUS_GOLD }}
        >
          Review
        </button>
      </section>
    </div>
  );

  const rightRail = (
    <aside className="space-y-4">
      <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm">
        <h2 className="text-lg font-black text-[var(--loombus-text)]">Create with clarity</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
          A great discussion starts with a clear setup.
        </p>
        <div className="mt-5 space-y-5">
          {readiness.checks.map((check, index) => (
            <div key={check.label} className="flex gap-3">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${
                  check.done ? "text-slate-950" : "bg-amber-50 text-amber-800"
                }`}
                style={check.done ? { backgroundColor: LOOMBUS_GOLD } : undefined}
              >
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-black text-[var(--loombus-text)]">{check.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">
                  {check.done ? "Ready" : "Needs attention before review"}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--loombus-surface-muted)]">
          <div
            className="h-full rounded-full"
            style={{ width: `${readiness.percent}%`, backgroundColor: LOOMBUS_GOLD }}
          />
        </div>
        <p className="mt-3 text-xs font-semibold text-[var(--loombus-text-muted)]">
          {readiness.completed} of {readiness.total} checks complete.
        </p>
      </section>

      <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Save className="size-5 text-amber-700" />
          <h2 className="font-black text-[var(--loombus-text)]">Private draft</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
          {autosaveStatus}
        </p>
        <p className="mt-2 text-xs font-semibold text-[var(--loombus-text-subtle)]">
          Last saved: {formatDraftTime(draftSavedAt)}
        </p>
      </section>

      <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm">
        <ShieldCheck className="mb-4 size-5 text-amber-700" />
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={copyDraft}
            className="rounded-2xl border border-[var(--loombus-border)] px-4 py-2 text-sm font-black text-amber-800 transition hover:border-amber-300 hover:bg-amber-50"
          >
            Copy draft
          </button>
          <button
            type="button"
            onClick={reviewDraft}
            disabled={draftLoading || publishing}
            className="rounded-2xl border border-[var(--loombus-border)] px-4 py-2 text-sm font-black text-[var(--loombus-text)] transition hover:border-amber-300 hover:bg-amber-50 disabled:opacity-60"
          >
            Review draft
          </button>
          <button
            type="submit"
            disabled={publishing}
            className="rounded-2xl px-4 py-2 text-center text-sm font-black text-slate-950 disabled:opacity-60"
            style={{ backgroundColor: LOOMBUS_GOLD }}
          >
            {publishing ? "Publishing..." : "Publish"}
          </button>
        </div>
        {copyMessage && (
          <p className="mt-3 text-xs leading-5 text-[var(--loombus-text-muted)]">{copyMessage}</p>
        )}
      </section>

      <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <FileText className="size-5 text-amber-700" />
          <h2 className="font-black text-[var(--loombus-text)]">Selected framing</h2>
        </div>
        <p className="mt-3 text-sm font-bold text-[var(--loombus-text)]">{selectedMode.label}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
          {selectedMode.description}
        </p>
        <div className="mt-4 space-y-2 text-xs font-semibold text-[var(--loombus-text-muted)]">
          <p>Topic: {topic || "Not selected"}</p>
          <p>Reality Lens: {realityLens || "Not selected"}</p>
          <p>Purpose Lane: {purposeLane || "Not selected"}</p>
          <p>
            Supporting context: {contextItems.length > 0 ? `${contextItems.length} staged` : "None staged"}
          </p>
        </div>
      </section>
    </aside>
  );

  return (
    <main
      data-create-composer-variant={variant}
      className={
        variant === "modal"
          ? "min-h-0 bg-transparent text-[var(--loombus-text)]"
          : "min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 lg:px-8"
      }
    >
      <SafetyWarningModal warning={safetyWarning} onClose={() => setSafetyWarning(null)} />
      <section className={variant === "modal" ? "mx-auto max-w-3xl p-4 sm:p-5" : "mx-auto max-w-7xl"}>
        <form
          onSubmit={publishDiscussion}
          className={variant === "modal" ? "block" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"}
        >
          {centerRail}
          {variant === "page" ? rightRail : null}
        </form>
      </section>

      {activePanel === "topic" && (
        <PanelShell title="Topic and classification" onClose={() => setActivePanel(null)}>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {([
              ["topics", "Topics"],
              ["reality", "Reality Lens"],
              ["purpose", "Purpose Lane"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPickerPanel(key)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${
                  pickerPanel === key
                    ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]"
                    : "bg-[var(--loombus-surface-muted)] text-[var(--loombus-text-muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {pickerPanel === "topics" && (
            <button
              type="button"
              onClick={() => {
                setTopic("Other");
                setRealityLens("");
                setPurposeLane("");
                setPickerPanel("reality");
              }}
              className="mb-4 w-full rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm font-black text-amber-950 dark:bg-amber-400/10 dark:text-amber-100"
            >
              Other: choose one Reality Lens or Purpose Lane
            </button>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {topicOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => chooseTopicOption(option)}
                className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-left text-sm font-bold text-[var(--loombus-text)] transition hover:border-amber-300"
              >
                {option}
              </button>
            ))}
          </div>

          {(topic || realityLens || purposeLane) && (
            <div className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 text-sm text-[var(--loombus-text-muted)]">
              <p>Topic: {topic || "Not selected"}</p>
              <p className="mt-1">Reality Lens: {realityLens || "Not selected"}</p>
              <p className="mt-1">Purpose Lane: {purposeLane || "Not selected"}</p>
            </div>
          )}
        </PanelShell>
      )}

      {activePanel === "mode" && (
        <PanelShell title="Discussion mode" onClose={() => setActivePanel(null)}>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODE_OPTIONS.map((option) => {
              const Icon = option.Icon;
              const selected = mode === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setMode(option.key);
                    setActivePanel(null);
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? "border-amber-400 bg-amber-50 text-amber-950 ring-2 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-100"
                      : "border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] text-[var(--loombus-text)] hover:border-amber-300"
                  }`}
                >
                  <Icon className="size-6 text-amber-700 dark:text-[#d6a84f]" />
                  <span className="mt-3 block text-sm font-black">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 opacity-75">{option.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </PanelShell>
      )}

      {activePanel === "add" && (
        <PanelShell title="Add supporting context" onClose={() => setActivePanel(null)}>
          <section>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={DISCUSSION_ATTACHMENT_ACCEPT}
              className="hidden"
              onChange={(event) => addSupportingContext(event, "file")}
            />
            <input
              ref={videoInputRef}
              type="file"
              multiple
              accept="video/*"
              className="hidden"
              onChange={(event) => addSupportingContext(event, "video")}
            />

            {attachmentsRestricted && (
              <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950 dark:bg-amber-400/10 dark:text-amber-100">
                Attachments are unavailable because Future Discussion visibility is restricted. Change it to Public in Settings.
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={attachmentsRestricted}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4 text-left transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-[#d6a84f]">
                  <ImageIcon className="size-5" />
                </span>
                <strong className="mt-3 block text-sm text-[var(--loombus-text)]">Attach files</strong>
                <span className="mt-1 block text-xs leading-5 text-[var(--loombus-text-muted)]">
                  Images and PDFs up to 10 MB.
                </span>
              </button>
              <button
                type="button"
                disabled={attachmentsRestricted}
                onClick={() => videoInputRef.current?.click()}
                className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4 text-left transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-[#d6a84f]">
                  <Mic className="size-5" />
                </span>
                <strong className="mt-3 block text-sm text-[var(--loombus-text)]">Video Context</strong>
                <span className="mt-1 block text-xs leading-5 text-[var(--loombus-text-muted)]">
                  MP4, MOV, or WebM within your plan limit.
                </span>
              </button>
            </div>

            {contextItems.length > 0 && (
              <div className="mt-5 space-y-2">
                {contextItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black text-[var(--loombus-text)]">{item.file.name}</p>
                      <p className="text-xs font-semibold text-[var(--loombus-text-subtle)]">
                        {item.kind === "video" || isVideoContextMimeType(item.file.type)
                          ? "Video"
                          : "File"}{" "}
                        · {formatFileSize(item.file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setContextItems((items) =>
                          items.filter((candidate) => candidate.id !== item.id)
                        )
                      }
                      className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--loombus-text-muted)] transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${item.file.name}`}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {attachmentMessage && (
              <p className="mt-4 text-sm font-bold text-[var(--loombus-text-muted)]">
                {attachmentMessage}
              </p>
            )}
          </section>
        </PanelShell>
      )}

      {activePanel === "guidance" && (
        <PanelShell title="Draft Guidance" onClose={() => setActivePanel(null)}>
          <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
            <div className="flex items-start gap-3">
              <Brain className="mt-0.5 size-5 text-amber-700 dark:text-[#d6a84f]" />
              <div>
                <h3 className="text-sm font-black text-[var(--loombus-text)]">
                  {selectedMode.label} structure
                </h3>
                <p className="mt-1 text-sm leading-6 text-[var(--loombus-text-muted)]">
                  {selectedMode.description}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {selectedMode.prompts.map((prompt) => (
                <span
                  key={prompt}
                  className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 py-2 text-xs font-bold text-[var(--loombus-text-muted)]"
                >
                  {prompt}
                </span>
              ))}
            </div>
            <button
              type="button"
              disabled={body.trim().length > 0}
              onClick={() => setBody(selectedMode.template)}
              className="mt-4 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm font-black text-[var(--loombus-text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use this structure
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={runQualityCheck}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 text-sm font-black text-[var(--loombus-text)]"
            >
              <Sparkles className="size-4 text-amber-700 dark:text-[#d6a84f]" />
              Check discussion quality
            </button>
            <button
              type="button"
              onClick={runClaritySuggestions}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black text-[#17140c]"
              style={{ backgroundColor: LOOMBUS_GOLD }}
            >
              <WandSparkles className="size-4" />
              Improve structure
            </button>
          </div>

          {aiMessage && (
            <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 text-sm font-semibold leading-6 text-[var(--loombus-text)]">
              {aiMessage}
            </p>
          )}

          {findings.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {findings.map((finding) => (
                <div
                  key={finding.label}
                  className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 text-sm"
                >
                  <p
                    className={`flex items-center gap-2 font-black ${
                      finding.done ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {finding.done ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <Circle className="size-4" />
                    )}
                    {finding.label}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[var(--loombus-text-muted)]">
                    {finding.detail}
                  </p>
                </div>
              ))}
            </div>
          )}
        </PanelShell>
      )}

      {activePanel === "more" && (
        <PanelShell title="More options" onClose={() => setActivePanel(null)}>
          <label className="block rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
            <span className="mb-2 flex items-center justify-between gap-3 text-sm font-black text-[var(--loombus-text)]">
              <span className="inline-flex items-center gap-2">
                <Tags className="size-4 text-amber-700 dark:text-[#d6a84f]" /> Tags
              </span>
              <span className="text-xs text-[var(--loombus-text-subtle)]">{tagCount}/5</span>
            </span>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Add up to 5 tags, separated by commas"
              className="min-h-12 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 text-sm text-[var(--loombus-text)] outline-none focus:border-amber-400"
            />
          </label>

          <div className="mt-4 grid gap-3">
            <button
              type="button"
              onClick={() => void saveDraft({ manual: true })}
              disabled={draftLoading}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 text-sm font-black text-[var(--loombus-text)] disabled:opacity-60"
            >
              <Save className="size-4" /> {draftLoading ? "Saving..." : "Save draft"}
            </button>
            <button
              type="button"
              onClick={copyDraft}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 text-sm font-black text-[var(--loombus-text)]"
            >
              <Copy className="size-4" /> Copy draft
            </button>
            <button
              type="button"
              onClick={clearDraft}
              disabled={draftLoading || publishing}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-red-300 px-4 text-sm font-black text-red-600 disabled:opacity-60"
            >
              <Trash2 className="size-4" /> Clear draft
            </button>
            <button
              type="button"
              disabled={publishing}
              onClick={() => {
                setActivePanel(null);
                void publishDiscussion();
              }}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black text-[#17140c] disabled:opacity-60"
              style={{ backgroundColor: LOOMBUS_GOLD }}
            >
              <Send className="size-4" /> {publishing ? "Publishing..." : "Publish now"}
            </button>
          </div>
        </PanelShell>
      )}
    </main>
  );
}
