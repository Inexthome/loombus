"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Eye,
  FileText,
  Home,
  Loader2,
  Lock,
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
  Settings,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type FeatureFlags = {
  v2_shell: boolean;
  v2_signal_brief: boolean;
  v2_rooms: boolean;
};

type ShellPayload = {
  version: "v1" | "v2";
  configured: boolean;
  authenticated: boolean;
  flags: FeatureFlags;
};

type DiscussionMode = "open_discussion" | "debate" | "research_question" | "problem_solving";

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

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const AUTOSAVE_DELAY_MS = 1400;
const DRAFT_MIGRATION_REQUIRED_MESSAGE =
  "Draft storage is not configured yet. Apply the V2 draft migration before testing save, restore, or autosave.";

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, active: true, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

const TOPIC_OPTIONS = ["Technology", "Society", "Governance", "Science", "Local", "Business", "Community", "Education"];

const DISCUSSION_MODES: Array<{
  key: DiscussionMode;
  label: string;
  shortLabel: string;
  description: string;
  Icon: typeof MessageSquare;
}> = [
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

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

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

function V2TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] text-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/v2" className="flex items-center gap-3 font-bold">
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 object-contain" />
          <span className="text-xl">Loombus</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {V2_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  item.active
                    ? "bg-white/10 text-white ring-1 ring-white/20"
                    : item.primary
                      ? "border border-white/40 text-white hover:bg-white/10"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Search className="size-5" />
          </Link>
          <Link href="/notifications" aria-label="Notifications" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Bell className="size-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-xs font-semibold text-slate-500">
        {V2_NAV_ITEMS.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${item.active ? "text-blue-600" : "text-slate-500"}`}>
              <Icon className={`size-5 ${item.primary ? "rounded-full bg-blue-600 p-1 text-white" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function GateCard({
  title,
  message,
  loading = false,
  payload,
}: {
  title: string;
  message: string;
  loading?: boolean;
  payload?: ShellPayload | null;
}) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-300/20">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>
        {payload && (
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">v2_rooms: {payload.flags.v2_rooms ? "on" : "off"}</span>
          </div>
        )}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">
            Return to V2 Home
          </Link>
          <Link href="/create" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">
            Open V1 Create
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function V2CreatePage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
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

  const selectedMode = DISCUSSION_MODES.find((option) => option.key === mode) ?? DISCUSSION_MODES[0];

  const draftFingerprint = useMemo(
    () => JSON.stringify({ title, topic, purpose, body, tags, mode }),
    [body, mode, purpose, tags, title, topic]
  );

  const hasDraftContent = useMemo(
    () => Boolean(title.trim() || topic.trim() || purpose.trim() || body.trim() || tags.trim() || mode !== "open_discussion"),
    [body, mode, purpose, tags, title, topic]
  );

  const readiness = useMemo(() => {
    const checks = [
      { label: "Choose a clear title", done: title.trim().length >= 8 },
      { label: "Select the right topic", done: topic.trim().length >= 2 },
      { label: "Select the right mode", done: Boolean(mode) },
      { label: "Add useful context", done: body.trim().length >= 40 },
      { label: "Invite meaningful responses", done: purpose.trim().length >= 8 },
    ];
    const completed = checks.filter((check) => check.done).length;

    return {
      checks,
      completed,
      total: checks.length,
      percent: Math.round((completed / checks.length) * 100),
    };
  }, [body, mode, purpose, title, topic]);

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

      setDraftId(draft.id);
      setDraftSavedAt(draft.updated_at);
      setTitle(draft.title ?? "");
      setTopic(draft.topic ?? "");
      setPurpose("");
      setBody(draft.body ?? "");
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
      const bodyWithPurpose = purpose.trim() ? `Purpose: ${purpose.trim()}\n\n${body}` : body;
      const { data, error } = await supabase
        .from("loombus_v2_create_drafts")
        .upsert(
          {
            user_id: userId,
            title,
            topic,
            body: bodyWithPurpose,
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
      setPurpose("");
      setBody("");
      setTags("");
      setMode("open_discussion");
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
    return <GateCard title="Checking V2 access" message="Loombus is verifying whether this account can use the V2 Create shell." loading />;
  }

  if (message) {
    return <GateCard title="V2 Create check failed safely" message={message} payload={payload} />;
  }

  if (!payload?.authenticated) {
    return <GateCard title="Sign in required" message="The V2 Create shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <GateCard title="V2 Create is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on the V1 Create experience." payload={payload} />;
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
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

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Topic <span className="text-red-500">*</span></span>
                  <input
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="Search or select a topic"
                    list="v2-topic-options"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                  <datalist id="v2-topic-options">
                    {TOPIC_OPTIONS.map((option) => <option key={option} value={option} />)}
                  </datalist>
                  <p className="mt-2 text-xs font-medium text-slate-500">Choose the best fit for your discussion.</p>
                </label>

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
                  <span className="mb-2 block text-sm font-bold text-slate-700">Purpose <span className="text-red-500">*</span></span>
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
                <h2 className="font-black text-slate-950">Selected mode</h2>
              </div>
              <p className="mt-3 text-sm font-bold text-slate-800">{selectedMode.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selectedMode.description}</p>
            </section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
