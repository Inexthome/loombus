"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Lock,
  MessageCircle,
  PenLine,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
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
  "Draft storage is not configured yet. Apply PR #102 Supabase migration before testing save, restore, or autosave.";

const PRIMARY_ACTION_BUTTON_CLASS =
  "appearance-none rounded-2xl border border-blue-300/40 bg-blue-500 px-4 py-2 text-center text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:border-blue-300/20 disabled:bg-blue-500/50 disabled:text-white/70";

const SECONDARY_ACTION_LINK_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-300/25 bg-blue-500/10 px-4 py-2 text-center text-sm font-bold text-blue-100 transition hover:border-blue-200/50 hover:bg-blue-500/20 hover:text-white";

const DISCUSSION_MODES: Array<{
  key: DiscussionMode;
  label: string;
  description: string;
}> = [
  {
    key: "open_discussion",
    label: "Open discussion",
    description: "Start a broad but focused discussion around a clear topic.",
  },
  {
    key: "debate",
    label: "Debate",
    description: "Frame opposing positions so replies can compare reasoning directly.",
  },
  {
    key: "research_question",
    label: "Research question",
    description: "Ask for evidence, sources, patterns, and careful uncertainty.",
  },
  {
    key: "problem_solving",
    label: "Problem solving",
    description: "Define a practical problem and invite solution-oriented replies.",
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

  if (Number.isNaN(date.getTime())) {
    return "Saved recently";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function FlagPill({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        enabled
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
          : "border-white/10 bg-white/5 text-slate-300"
      }`}
    >
      {label}: {enabled ? "on" : "off"}
    </span>
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
    <main
      className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white"
      style={{ colorScheme: "dark", backgroundColor: "#020617" }}
    >
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
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
          <div className="mt-5 flex flex-wrap gap-2">
            <FlagPill label="v2_shell" enabled={payload.flags.v2_shell} />
            <FlagPill label="v2_signal_brief" enabled={payload.flags.v2_signal_brief} />
            <FlagPill label="v2_rooms" enabled={payload.flags.v2_rooms} />
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/v2"
            className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200"
          >
            Return to V2 Home
          </Link>
          <Link
            href="/create"
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
          >
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
    () => JSON.stringify({ title, topic, body, tags, mode }),
    [body, mode, tags, title, topic]
  );

  const hasDraftContent = useMemo(
    () => Boolean(title.trim() || topic.trim() || body.trim() || tags.trim() || mode !== "open_discussion"),
    [body, mode, tags, title, topic]
  );

  const readiness = useMemo(() => {
    const checks = [
      {
        label: "Clear title",
        done: title.trim().length >= 8,
      },
      {
        label: "Topic selected",
        done: topic.trim().length >= 2,
      },
      {
        label: "Body has context",
        done: body.trim().length >= 40,
      },
      {
        label: "Mode selected",
        done: Boolean(mode),
      },
    ];

    const completed = checks.filter((check) => check.done).length;

    return {
      checks,
      completed,
      total: checks.length,
      percent: Math.round((completed / checks.length) * 100),
    };
  }, [body, mode, title, topic]);

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
      if (manual) {
        setDraftMessage("Sign in is required before saving a V2 draft.");
      }
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
            body,
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

      if (manual) {
        setDraftMessage("Private V2 draft saved.");
      }

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
        const { error } = await supabase
          .from("loombus_v2_create_drafts")
          .delete()
          .eq("user_id", userId);

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
      setBody("");
      setTags("");
      setMode("open_discussion");
      setDraftHydrated(true);
      setAutosaveStatus("Draft cleared");
      setDraftMessage("Private V2 draft cleared.");
    } catch {
      setAutosaveStatus("Clear failed");
      setDraftMessage("Draft could not be cleared. Current V1 Create remains unchanged.");
    } finally {
      setDraftLoading(false);
    }
  }

  async function copyPreviewDraft() {
    setCopyMessage("");

    const draft = [
      `Title: ${title.trim() || "Untitled signal"}`,
      `Topic: ${topic.trim() || "Not selected"}`,
      `Mode: ${selectedMode?.label ?? "Open discussion"}`,
      tags.trim() ? `Tags: ${tags.trim()}` : null,
      "",
      body.trim() || "No body text yet.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(draft);
      setCopyMessage("Draft copied. Paste it into the current V1 composer when ready.");
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

      if (
        nextUserId &&
        accessToken &&
        nextPayload.configured &&
        nextPayload.flags.v2_shell &&
        nextPayload.version === "v2"
      ) {
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

    if (!canAutosave) {
      return;
    }

    setAutosaveStatus("Autosave pending...");

    const timer = window.setTimeout(() => {
      persistDraft({ manual: false });
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [draftFingerprint, draftHydrated, hasDraftContent, loading, payload, userId]);

  if (loading) {
    return (
      <GateCard
        title="Checking V2 access"
        message="Loombus is verifying whether this account can use the V2 Create preview."
        loading
      />
    );
  }

  if (message) {
    return (
      <GateCard
        title="V2 Create preview check failed safely"
        message={message}
        payload={payload}
      />
    );
  }

  if (!payload?.authenticated) {
    return (
      <GateCard
        title="Sign in required"
        message="The V2 Create preview is internal-only right now. Sign in first so Loombus can check your v2_shell access."
        payload={payload}
      />
    );
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return (
      <GateCard
        title="V2 Create preview is not enabled"
        message="This account is not currently allowed through the v2_shell flag. Public users remain on the V1 Create experience."
        payload={payload}
      />
    );
  }

  return (
    <main
      className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#07111f] text-white"
      style={{ colorScheme: "dark", backgroundColor: "#07111f" }}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.26),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(212,175,55,0.18),_transparent_32%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 text-white sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link href="/v2" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-white">
              <ArrowLeft className="size-4" />
              Back to V2 Home
            </Link>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2 Preview</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">Create a signal with structure.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              This gated V2 Create preview can autosave one private draft for your signed-in account. It still does not submit or publish posts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <FlagPill label="v2_shell" enabled={payload.flags.v2_shell} />
            <FlagPill label="v2_signal_brief" enabled={payload.flags.v2_signal_brief} />
            <FlagPill label="v2_rooms" enabled={payload.flags.v2_rooms} />
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <PenLine className="size-5 text-blue-200" />
                  <h2 className="text-xl font-bold text-white">Signal draft</h2>
                </div>
                <span className="text-xs text-slate-400">{draftLoading ? "Syncing draft..." : formatDraftTime(draftSavedAt)}</span>
              </div>

              {draftMessage && (
                <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100">
                  {draftMessage}
                </div>
              )}

              <div className="mt-5 grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Ask a clear question or frame a useful discussion"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Topic</span>
                  <input
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="Technology, community, business, health, education..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Body</span>
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder="Add context, what you are trying to understand, and what kind of replies would be useful."
                    rows={9}
                    className="w-full resize-y rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Optional tags</span>
                  <input
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    placeholder="clarity, ai, jacksonville, policy"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/50"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <MessageCircle className="size-5 text-blue-200" />
                <h2 className="text-xl font-bold text-white">Discussion mode</h2>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {DISCUSSION_MODES.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setMode(option.key)}
                    className={`appearance-none rounded-3xl border p-4 text-left transition ${
                      mode === option.key
                        ? "border-blue-300/45 bg-blue-500/15 text-white"
                        : "border-white/10 bg-slate-950/80 text-slate-300 hover:border-blue-300/25 hover:bg-blue-500/10"
                    }`}
                  >
                    <span className="text-sm font-bold">{option.label}</span>
                    <span className="mt-2 block text-xs leading-5 text-slate-400">{option.description}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Save className="size-5 text-blue-200" />
                <h2 className="font-bold text-white">Private draft</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Autosave stores one V2 draft to your signed-in account. This does not publish anything and does not affect V1 Create.
              </p>
              <p className="mt-3 rounded-2xl border border-blue-300/20 bg-blue-400/10 px-3 py-2 text-xs font-semibold text-blue-100">
                {autosaveStatus}
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => persistDraft({ manual: true })}
                  disabled={draftLoading}
                  className={PRIMARY_ACTION_BUTTON_CLASS}
                >
                  {draftLoading ? "Saving..." : "Save now"}
                </button>
                <Link href="/v2/create/review" className={SECONDARY_ACTION_LINK_CLASS}>
                  <Eye className="size-4" />
                  Review draft
                </Link>
                <button
                  type="button"
                  onClick={clearDraft}
                  disabled={draftLoading}
                  className="inline-flex appearance-none items-center justify-center gap-2 rounded-2xl border border-white/15 bg-transparent px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="size-4" />
                  Clear draft
                </button>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-emerald-200" />
                <h2 className="font-bold text-white">Draft readiness</h2>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-blue-400" style={{ width: `${readiness.percent}%` }} />
              </div>
              <p className="mt-3 text-sm text-slate-300">
                {readiness.completed} of {readiness.total} structure checks complete.
              </p>

              <div className="mt-4 space-y-2">
                {readiness.checks.map((check) => (
                  <div key={check.label} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm">
                    <span className="text-slate-300">{check.label}</span>
                    <span className={check.done ? "text-emerald-200" : "text-slate-500"}>{check.done ? "Ready" : "Needed"}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#d4af37]/25 bg-[#d4af37]/10 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Sparkles className="size-5 text-[#f7d56d]" />
                <h2 className="font-bold text-[#f7d56d]">Preview only</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#fff3c4]">
                This screen can autosave a private draft, but it still does not write to the live discussions table.
              </p>
            </section>

            <section className="rounded-[2rem] border border-emerald-400/25 bg-emerald-400/10 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-emerald-200" />
                <h2 className="font-bold text-emerald-100">Safe handoff</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-emerald-50/80">
                Copy your preview draft, then open the current V1 composer when you are ready to publish.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={copyPreviewDraft}
                  className={PRIMARY_ACTION_BUTTON_CLASS}
                >
                  Copy draft
                </button>
                <Link
                  href="/create"
                  className="rounded-2xl border border-white/10 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
                >
                  Open V1 Create
                </Link>
              </div>
              {copyMessage && <p className="mt-3 text-xs leading-5 text-emerald-50/80">{copyMessage}</p>}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-blue-200" />
                <h2 className="font-bold text-white">Selected mode</h2>
              </div>
              <p className="mt-3 text-sm font-semibold text-white">{selectedMode?.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{selectedMode?.description}</p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
