"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  MessageCircle,
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
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { REALITY_LENSES } from "@/lib/reality-lenses";
import { PURPOSE_LANES } from "@/lib/purpose-lanes";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../v2-shell-components";

type DiscussionMode = "open_discussion" | "debate" | "research_question" | "problem_solving";
type MetadataPickerPanel = "topics" | "reality_lens" | "purpose_lane";

type V2CreateDraft = {
  id: string;
  user_id: string;
  title: string | null;
  topic: string | null;
  body: string | null;
  tags: string | null;
  mode: string | null;
  updated_at: string | null;
};

type DiscussionModeOption = {
  key: DiscussionMode;
  label: string;
  shortLabel: string;
  description: string;
  Icon: LucideIcon;
};

type AiFinding = {
  label: string;
  done: boolean;
  detail: string;
};

const AUTOSAVE_DELAY_MS = 1400;
const DRAFT_MIGRATION_REQUIRED_MESSAGE =
  "Draft storage is not configured yet. Apply the V2 draft migration before testing save, restore, or autosave.";

const DISCUSSION_MODES: DiscussionModeOption[] = [
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
  return DISCUSSION_MODES.some((option) => option.key === value);
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

function getTagCount(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5).length;
}

function getCleanBody(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildDraftBody({
  body,
  purpose,
  realityLens,
  purposeLane,
}: {
  body: string;
  purpose: string;
  realityLens: string;
  purposeLane: string;
}) {
  const metadataLines = [
    purpose.trim() ? `Purpose: ${purpose.trim()}` : "",
    realityLens.trim() ? `Reality Lens: ${realityLens.trim()}` : "",
    purposeLane.trim() ? `Purpose Lane: ${purposeLane.trim()}` : "",
  ].filter(Boolean);

  return metadataLines.length > 0 ? `${metadataLines.join("\n")}\n\n${body}` : body;
}

function hydrateDraftBody(value: string | null) {
  const raw = value ?? "";
  const parts = raw.split(/\n\n/);
  const firstBlock = parts[0] ?? "";
  const rest = parts.slice(1).join("\n\n");
  const metadata: Record<string, string> = {};
  const metadataLines = firstBlock.split("\n");
  const hasMetadata = metadataLines.every((line) => /^(Purpose|Reality Lens|Purpose Lane):\s*/.test(line));

  if (!hasMetadata) {
    return { body: raw, purpose: "", realityLens: "", purposeLane: "" };
  }

  for (const line of metadataLines) {
    const [key, ...valueParts] = line.split(":");
    metadata[key.trim()] = valueParts.join(":").trim();
  }

  return {
    body: rest,
    purpose: metadata.Purpose ?? "",
    realityLens: metadata["Reality Lens"] ?? "",
    purposeLane: metadata["Purpose Lane"] ?? "",
  };
}

function buildQualityFindings({
  title,
  topic,
  realityLens,
  purposeLane,
  purpose,
  body,
  tags,
}: {
  title: string;
  topic: string;
  realityLens: string;
  purposeLane: string;
  purpose: string;
  body: string;
  tags: string;
}): AiFinding[] {
  const cleanBody = getCleanBody(body);
  const bodyWords = cleanBody ? cleanBody.split(" ").length : 0;

  return [
    {
      label: "Clear title",
      done: title.trim().length >= 8,
      detail: title.trim().length >= 8 ? "The title gives readers a clear entry point." : "Use a specific title with at least 8 characters.",
    },
    {
      label: "Topic selected",
      done: topic.trim().length >= 2,
      detail: topic.trim().length >= 2 ? "A topic is selected for discovery." : "Pick a topic from the plus menu or type one in.",
    },
    {
      label: "Reality lens",
      done: realityLens.trim().length > 0,
      detail: realityLens.trim() ? "A reality lens adds emotional or human context." : "Choose a reality lens when the discussion needs deeper context.",
    },
    {
      label: "Purpose lane",
      done: purposeLane.trim().length > 0,
      detail: purposeLane.trim() ? "A purpose lane helps frame why the discussion matters." : "Choose a purpose lane to guide responses.",
    },
    {
      label: "Useful body context",
      done: bodyWords >= 35,
      detail: bodyWords >= 35 ? "The body has enough context for meaningful replies." : "Add more background, stakes, or examples before review.",
    },
    {
      label: "Response intent",
      done: purpose.trim().length >= 8,
      detail: purpose.trim().length >= 8 ? "The purpose tells readers how to respond." : "Explain what you want others to help clarify, solve, or debate.",
    },
    {
      label: "Discovery tags",
      done: getTagCount(tags) > 0,
      detail: getTagCount(tags) > 0 ? "Tags improve discoverability." : "Add one or more tags when useful.",
    },
  ];
}

function buildClarityRewrite({
  title,
  topic,
  realityLens,
  purposeLane,
  purpose,
  body,
}: {
  title: string;
  topic: string;
  realityLens: string;
  purposeLane: string;
  purpose: string;
  body: string;
}) {
  const cleanBody = body.trim();
  const sections = [
    title.trim() ? `Main point: ${title.trim()}` : "Main point: I want to start a focused discussion.",
    topic.trim() ? `Topic: ${topic.trim()}` : "",
    realityLens.trim() ? `Reality lens: ${realityLens.trim()}` : "",
    purposeLane.trim() ? `Purpose lane: ${purposeLane.trim()}` : "",
    "",
    "Context:",
    cleanBody || "Add the background, situation, or question that people need before responding.",
    "",
    "What I want from the discussion:",
    purpose.trim() || "I want thoughtful replies that add clarity, useful examples, and practical insight.",
  ].filter((section, index) => section !== "" || index === 4 || index === 7);

  return sections.join("\n");
}

function MetadataPicker({
  open,
  activePanel,
  setActivePanel,
  onClose,
  onSelectTopic,
  onSelectRealityLens,
  onSelectPurposeLane,
}: {
  open: boolean;
  activePanel: MetadataPickerPanel;
  setActivePanel: (panel: MetadataPickerPanel) => void;
  onClose: () => void;
  onSelectTopic: (value: string) => void;
  onSelectRealityLens: (value: string) => void;
  onSelectPurposeLane: (value: string) => void;
}) {
  if (!open) return null;

  const options =
    activePanel === "topics"
      ? DISCUSSION_TOPICS
      : activePanel === "reality_lens"
        ? REALITY_LENSES
        : PURPOSE_LANES;
  const selectOption =
    activePanel === "topics"
      ? onSelectTopic
      : activePanel === "reality_lens"
        ? onSelectRealityLens
        : onSelectPurposeLane;

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-950/15 ring-1 ring-slate-900/5">
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {[
          { key: "topics" as const, label: "Topics" },
          { key: "reality_lens" as const, label: "Reality Lens" },
          { key: "purpose_lane" as const, label: "Purpose Lane" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActivePanel(item.key)}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-black transition ${
              activePanel === item.key ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              selectOption(option);
              onClose();
            }}
            className="rounded-2xl border border-slate-200 px-3 py-2 text-left text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function V2CreatePage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [realityLens, setRealityLens] = useState("");
  const [purposeLane, setPurposeLane] = useState("");
  const [purpose, setPurpose] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [mode, setMode] = useState<DiscussionMode>("open_discussion");
  const [copyMessage, setCopyMessage] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState("Autosave idle");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activePickerPanel, setActivePickerPanel] = useState<MetadataPickerPanel>("topics");
  const [aiFindings, setAiFindings] = useState<AiFinding[]>([]);
  const [aiMessage, setAiMessage] = useState("");

  const selectedMode = DISCUSSION_MODES.find((option) => option.key === mode) ?? DISCUSSION_MODES[0];

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

    return {
      checks,
      completed,
      total: checks.length,
      percent: Math.round((completed / checks.length) * 100),
    };
  }, [body, mode, purpose, purposeLane, title, topic]);

  function runQualityCheck() {
    const findings = buildQualityFindings({ title, topic, realityLens, purposeLane, purpose, body, tags });
    const completed = findings.filter((finding) => finding.done).length;
    setAiFindings(findings);
    setAiMessage(`Discussion quality check complete: ${completed} of ${findings.length} checks are ready.`);
  }

  function rewriteForClarity() {
    const rewrittenBody = buildClarityRewrite({ title, topic, realityLens, purposeLane, purpose, body });
    setBody(rewrittenBody.slice(0, 3000));
    setAiMessage("Rewrite for clarity applied to the body field. Review it before saving or publishing.");
    setAiFindings(buildQualityFindings({ title, topic, realityLens, purposeLane, purpose, body: rewrittenBody, tags }));
  }

  async function loadSavedDraft(nextUserId: string) {
    setDraftLoading(true);
    setDraftHydrated(false);
    setDraftMessage("");
    setAutosaveStatus("Loading draft...");

    try {
      const { data, error } = await supabase
        .from("loombus_v2_create_drafts")
        .select("id, user_id, title, topic, body, tags, mode, updated_at")
        .eq("user_id", nextUserId)
        .maybeSingle();

      if (error) {
        setDraftHydrated(false);
        setAutosaveStatus("Migration required");
        setDraftMessage(DRAFT_MIGRATION_REQUIRED_MESSAGE);
        return;
      }

      const draft = data as V2CreateDraft | null;
      if (!draft) {
        setDraftId(null);
        setDraftSavedAt(null);
        setDraftHydrated(true);
        setAutosaveStatus("Ready to autosave");
        return;
      }

      const hydratedBody = hydrateDraftBody(draft.body);
      setDraftId(draft.id);
      setDraftSavedAt(draft.updated_at);
      setTitle(draft.title ?? "");
      setTopic(draft.topic ?? "");
      setRealityLens(hydratedBody.realityLens);
      setPurposeLane(hydratedBody.purposeLane);
      setPurpose(hydratedBody.purpose);
      setBody(hydratedBody.body);
      setTags(draft.tags ?? "");
      setMode(isDiscussionMode(draft.mode) ? draft.mode : "open_discussion");
      setDraftHydrated(true);
      setAutosaveStatus("Draft restored");
      setDraftMessage("Private V2 draft restored.");
    } catch {
      setDraftHydrated(false);
      setAutosaveStatus("Autosave unavailable");
      setDraftMessage("Unable to load the private V2 draft. V1 Create remains available.");
    } finally {
      setDraftLoading(false);
    }
  }

  async function persistDraft({ manual = false }: { manual?: boolean } = {}) {
    if (!userId) {
      if (manual) setDraftMessage("Sign in is required before saving a V2 draft.");
      return false;
    }

    setDraftLoading(true);
    if (manual) {
      setDraftMessage("");
    } else {
      setAutosaveStatus("Autosaving...");
    }

    try {
      const { data, error } = await supabase
        .from("loombus_v2_create_drafts")
        .upsert(
          {
            user_id: userId,
            title,
            topic,
            body: buildDraftBody({ body, purpose, realityLens, purposeLane }),
            tags,
            mode,
          },
          { onConflict: "user_id" }
        )
        .select("id, updated_at")
        .single();

      if (error) {
        setAutosaveStatus("Migration required");
        setDraftMessage(DRAFT_MIGRATION_REQUIRED_MESSAGE);
        return false;
      }

      const savedDraft = data as { id: string; updated_at: string | null };
      setDraftId(savedDraft.id);
      setDraftSavedAt(savedDraft.updated_at);
      setAutosaveStatus("Autosaved");
      if (manual) setDraftMessage("Private V2 draft saved.");
      return true;
    } catch {
      if (manual) {
        setDraftMessage("Draft could not be saved. Current V1 Create remains unchanged.");
      } else {
        setAutosaveStatus("Autosave failed");
      }
      return false;
    } finally {
      setDraftLoading(false);
    }
  }

  async function clearDraft() {
    if (!userId) {
      setDraftMessage("Sign in is required before clearing a V2 draft.");
      return;
    }

    setDraftLoading(true);
    setDraftMessage("");
    setAutosaveStatus("Clearing draft...");

    try {
      if (draftId) {
        const { error } = await supabase.from("loombus_v2_create_drafts").delete().eq("user_id", userId);
        if (error) {
          setAutosaveStatus("Migration required");
          setDraftMessage(DRAFT_MIGRATION_REQUIRED_MESSAGE);
          return;
        }
      }

      setDraftId(null);
      setDraftSavedAt(null);
      setTitle("");
      setTopic("");
      setRealityLens("");
      setPurposeLane("");
      setPurpose("");
      setBody("");
      setTags("");
      setMode("open_discussion");
      setAiFindings([]);
      setAiMessage("");
      setDraftHydrated(true);
      setAutosaveStatus("Draft cleared");
      setDraftMessage("Private V2 draft cleared.");
    } catch {
      setAutosaveStatus("Clear failed");
      setDraftMessage("Unable to clear this V2 draft safely.");
    } finally {
      setDraftLoading(false);
    }
  }

  async function copyPreviewDraft() {
    const text = [
      title.trim() ? `Title: ${title.trim()}` : "Title:",
      topic.trim() ? `Topic: ${topic.trim()}` : "Topic:",
      realityLens.trim() ? `Reality Lens: ${realityLens.trim()}` : "Reality Lens:",
      purposeLane.trim() ? `Purpose Lane: ${purposeLane.trim()}` : "Purpose Lane:",
      `Mode: ${selectedMode.label}`,
      purpose.trim() ? `Purpose: ${purpose.trim()}` : "Purpose:",
      tags.trim() ? `Tags: ${tags.trim()}` : "Tags:",
      "",
      body.trim() || "Body:",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Draft copied. You can paste it into V1 Create if needed.");
    } catch {
      setCopyMessage("Unable to copy this draft from the browser. You can still manually copy the fields.");
    }
  }

  async function loadShell() {
    setLoading(true);
    setMessage("");
    setDraftHydrated(false);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const nextUserId = data.session?.user.id ?? null;
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;

      setPayload(nextPayload);
      setUserId(nextUserId);

      if (nextUserId && accessToken && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") {
        await loadSavedDraft(nextUserId);
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setAutosaveStatus("Autosave unavailable");
      setMessage("Unable to verify V2 create preview access. Current Loombus remains on V1.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();

    const { data } = supabase.auth.onAuthStateChange(() => {
      loadShell();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const canAutosave =
      userId &&
      !loading &&
      draftHydrated &&
      payload?.configured &&
      payload.flags.v2_shell &&
      payload.version === "v2" &&
      hasDraftContent;

    if (!canAutosave) return;

    setAutosaveStatus("Autosave pending...");
    const timer = window.setTimeout(() => {
      persistDraft({ manual: false });
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [draftFingerprint, draftHydrated, hasDraftContent, loading, payload, userId]);

  if (loading) {
    return <V2ShellGateCard title="Checking V2 access" message="Loombus is verifying whether this account can use the V2 Create shell." loading />;
  }

  if (message) {
    return <V2ShellGateCard title="V2 Create check failed safely" message={message} payload={payload} />;
  }

  if (!payload?.authenticated) {
    return <V2ShellGateCard title="Sign in required" message="The V2 Create shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <V2ShellGateCard title="V2 Create is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on the V1 Create experience." payload={payload} />;
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-5">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Create Discussion</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Start a meaningful conversation. Give your community something worth discussing.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              {draftMessage && (
                <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                  {draftMessage}
                </div>
              )}

              <div className="grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Discussion Title <span className="text-red-500">*</span></span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g., The future of decentralized identity"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                  <p className="mt-2 text-xs font-medium text-slate-500">Be clear, specific, and engaging.</p>
                </label>

                <div className="relative">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Topic <span className="text-red-500">*</span></span>
                  <div className="flex rounded-xl border border-slate-200 bg-white shadow-sm transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
                    <button
                      type="button"
                      onClick={() => setPickerOpen((current) => !current)}
                      aria-expanded={pickerOpen}
                      aria-label="Open topic and metadata picker"
                      className="grid w-12 shrink-0 place-items-center rounded-l-xl border-r border-slate-200 text-blue-700 transition hover:bg-blue-50"
                    >
                      <Plus className="size-5" />
                    </button>
                    <input
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      placeholder="Search or select a topic"
                      list="v2-topic-options"
                      className="min-w-0 flex-1 rounded-r-xl bg-transparent px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                    <datalist id="v2-topic-options">
                      {DISCUSSION_TOPICS.map((option) => <option key={option} value={option} />)}
                    </datalist>
                  </div>
                  <MetadataPicker
                    open={pickerOpen}
                    activePanel={activePickerPanel}
                    setActivePanel={setActivePickerPanel}
                    onClose={() => setPickerOpen(false)}
                    onSelectTopic={setTopic}
                    onSelectRealityLens={setRealityLens}
                    onSelectPurposeLane={setPurposeLane}
                  />
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                    {realityLens && <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">Reality Lens: {realityLens}</span>}
                    {purposeLane && <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Purpose Lane: {purposeLane}</span>}
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500">Use the plus menu to choose a topic, reality lens, or purpose lane.</p>
                </div>

                <div>
                  <p className="mb-3 text-sm font-bold text-slate-700">Discussion Mode <span className="text-red-500">*</span></p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {DISCUSSION_MODES.map((option) => {
                      const Icon = option.Icon;
                      const selected = mode === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setMode(option.key)}
                          className={`rounded-2xl border p-4 text-center transition ${selected ? "border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/50"}`}
                        >
                          <Icon className={`mx-auto size-7 ${selected ? "text-blue-600" : "text-slate-700"}`} />
                          <span className={`mt-3 block text-sm font-black ${selected ? "text-blue-700" : "text-slate-800"}`}>{option.label}</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">{option.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Discussion Purpose <span className="text-red-500">*</span></span>
                  <input
                    value={purpose}
                    onChange={(event) => setPurpose(event.target.value)}
                    placeholder="What do you hope to achieve with this discussion?"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                  <p className="mt-2 text-xs font-medium text-slate-500">Define your intent to guide better responses.</p>
                </label>

                <label className="block">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-700">Body <span className="text-red-500">*</span></span>
                    <span className="text-xs font-semibold text-slate-400">{body.length}/3000</span>
                  </div>
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value.slice(0, 3000))}
                    placeholder="Provide context, background, or details for your discussion..."
                    rows={8}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                  <p className="mt-2 text-xs font-medium text-slate-500">The more context you provide, the better the conversation.</p>
                </label>

                <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="flex items-center gap-2 text-sm font-black text-blue-900"><Brain className="size-4" />AI draft tools</h2>
                      <p className="mt-1 text-xs font-semibold leading-5 text-blue-800">Check discussion quality or rewrite the body for clarity before review.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={runQualityCheck} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-blue-700 shadow-sm ring-1 ring-blue-100 transition hover:bg-blue-100">
                        <Sparkles className="size-4" />
                        Discussion quality check
                      </button>
                      <button type="button" onClick={rewriteForClarity} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-blue-700">
                        <WandSparkles className="size-4" />
                        Rewrite for clarity
                      </button>
                    </div>
                  </div>
                  {aiMessage && <p className="mt-3 text-xs font-bold text-blue-900">{aiMessage}</p>}
                  {aiFindings.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {aiFindings.map((finding) => (
                        <div key={finding.label} className="rounded-xl bg-white px-3 py-2 text-xs shadow-sm ring-1 ring-blue-100">
                          <p className={`flex items-center gap-2 font-black ${finding.done ? "text-emerald-700" : "text-amber-700"}`}>
                            {finding.done ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
                            {finding.label}
                          </p>
                          <p className="mt-1 leading-5 text-slate-600">{finding.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <label className="block">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-700">Tags</span>
                    <span className="text-xs font-semibold text-slate-400">{getTagCount(tags)}/5</span>
                  </div>
                  <input
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    placeholder="Add up to 5 tags, e.g., web3, governance, identity"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                  <p className="mt-2 text-xs font-medium text-slate-500">Tags help others discover your discussion.</p>
                </label>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-sm font-black text-slate-800">Attach supporting context <span className="font-medium text-slate-400">(optional)</span></p>
              <p className="mt-1 text-xs font-medium text-slate-500">Add relevant materials that help others contribute with more depth.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Paperclip className="size-5" /></span>
                    <div>
                      <p className="text-sm font-black text-slate-800">Attach Files</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Placeholder for V2 file uploads. Current upload remains in V1 Create.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Mic className="size-5" /></span>
                    <div>
                      <p className="text-sm font-black text-slate-800">Video Context</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Placeholder for V2 video context. Current upload remains in V1 Create.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => persistDraft({ manual: true })} disabled={draftLoading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60">
                    <Save className="size-4" />
                    {draftLoading ? "Saving..." : "Save Draft"}
                  </button>
                  <button type="button" onClick={clearDraft} disabled={draftLoading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                    <Trash2 className="size-4" />
                    Clear
                  </button>
                </div>
                <Link href="/v2/create/review" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700">
                  <Send className="size-4" />
                  Review Draft
                </Link>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Create with clarity</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">A great discussion starts with a clear setup.</p>
              <div className="mt-5 space-y-5">
                {readiness.checks.map((check, index) => (
                  <div key={check.label} className="flex gap-3">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${check.done ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}>{index + 1}</span>
                    <div>
                      <p className="text-sm font-black text-slate-800">{check.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{check.done ? "Ready" : "Needs attention before review"}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${readiness.percent}%` }} />
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">{readiness.completed} of {readiness.total} checks complete.</p>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Save className="size-5 text-blue-600" />
                <h2 className="font-black text-slate-950">Private draft</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{autosaveStatus}</p>
              <p className="mt-2 text-xs font-semibold text-slate-400">Last saved: {formatDraftTime(draftSavedAt)}</p>
            </section>

            <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-amber-700" />
                <h2 className="font-black text-amber-900">Preview only</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-amber-800">This V2 shell can autosave a private draft, but it does not publish to the live discussion feed.</p>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-black text-slate-950">Safe handoff</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Use V1 Create if you need to publish before V2 release testing is complete.</p>
              <div className="mt-4 flex flex-col gap-3">
                <button type="button" onClick={copyPreviewDraft} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700">
                  Copy draft
                </button>
                <Link href="/create" className="rounded-2xl border border-slate-200 px-4 py-2 text-center text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700">
                  Open V1 Create
                </Link>
              </div>
              {copyMessage && <p className="mt-3 text-xs leading-5 text-slate-500">{copyMessage}</p>}
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-blue-600" />
                <h2 className="font-black text-slate-950">Selected framing</h2>
              </div>
              <p className="mt-3 text-sm font-bold text-slate-800">{selectedMode.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selectedMode.description}</p>
              <div className="mt-4 space-y-2 text-xs font-semibold text-slate-500">
                <p>Topic: {topic || "Not selected"}</p>
                <p>Reality Lens: {realityLens || "Not selected"}</p>
                <p>Purpose Lane: {purposeLane || "Not selected"}</p>
              </div>
            </section>
          </aside>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
