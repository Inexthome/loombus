"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { supabase } from "@/lib/supabase/client";
import {
  CalendarPlus,
  FilePenLine,
  Radio,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type View = "programming" | "research" | "contributors";
type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
};
type Program = {
  id: string;
  title: string;
  format: string;
  description: string;
  focus: string;
  starts_at: string;
  duration_minutes: number;
  host_id: string;
  meeting_url: string | null;
  replay_url: string | null;
  replay_summary: string | null;
  status: string;
};
type Publication = {
  id: string;
  slug: string;
  publication_type: string;
  title: string;
  excerpt: string;
  body: string;
  tickers: string[];
  sources: unknown[];
  author_id: string | null;
  reviewer_id: string | null;
  public_byline: string;
  public_approval_label: string;
  status: string;
  published_at: string | null;
};
type Contributor = {
  user_id: string;
  status: string;
  specialties: string[];
  disclosure: string;
  target_cadence: string;
  accepted_at: string | null;
};
type Assignment = {
  id: string;
  contributor_id: string;
  title: string;
  focus: string;
  due_at: string;
  status: string;
  publication_id: string | null;
};

const card =
  "rounded-[1.25rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5";
const input =
  "min-h-11 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 text-sm outline-none focus:border-[var(--loombus-gold)]";
const label =
  "grid gap-1.5 text-xs font-black text-[var(--loombus-text-muted)]";
const gold =
  "rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50";
function name(profile?: Profile) {
  return profile?.full_name?.trim() || profile?.username || "Unknown member";
}
function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function localDate(value: string) {
  return value ? new Date(value).toLocaleString() : "Not scheduled";
}

export default function AdminFloorProgramClient() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [working, setWorking] = useState(false);
  const [researching, setResearching] = useState(false);
  const [view, setView] = useState<View>("programming");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [adminId, setAdminId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [programForm, setProgramForm] = useState({
    title: "",
    format: "opening_bell",
    description: "",
    focus: "",
    startsAt: "",
    duration: "45",
    hostId: "",
    meetingUrl: "",
  });
  const [publicationForm, setPublicationForm] = useState({
    title: "",
    slug: "",
    type: "daily_briefing",
    excerpt: "",
    body: "",
    tickers: "",
    sources: "",
    researchFocus: "",
    aiAssisted: false,
    modelProvider: "",
    modelName: "",
    promptVersion: "",
    status: "draft",
  });
  const [assignmentForm, setAssignmentForm] = useState({
    contributorId: "",
    title: "",
    focus: "",
    dueAt: "",
    publicationId: "",
  });

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );
  const load = useCallback(async () => {
    setError("");
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) {
      window.location.replace("/login?next=%2Fadmin%2Ffloor-program");
      return;
    }
    const gate = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", auth.data.user.id)
      .maybeSingle();
    if (!gate.data?.is_admin) {
      window.location.replace("/discussions?admin=denied");
      return;
    }
    setAdminId(auth.data.user.id);
    setAllowed(true);
    const [
      profileResult,
      programResult,
      publicationResult,
      contributorResult,
      assignmentResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,username")
        .order("full_name", { ascending: true })
        .limit(1000),
      supabase
        .from("floor_live_programs")
        .select(
          "id,title,format,description,focus,starts_at,duration_minutes,host_id,meeting_url,replay_url,replay_summary,status",
        )
        .order("starts_at", { ascending: false }),
      supabase
        .from("floor_research_publications")
        .select(
          "id,slug,publication_type,title,excerpt,body,tickers,sources,author_id,reviewer_id,public_byline,public_approval_label,status,published_at",
        )
        .order("updated_at", { ascending: false }),
      supabase
        .from("floor_contributor_profiles")
        .select(
          "user_id,status,specialties,disclosure,target_cadence,accepted_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("floor_contributor_assignments")
        .select("id,contributor_id,title,focus,due_at,status,publication_id")
        .order("due_at", { ascending: false }),
    ]);
    const firstError = [
      profileResult,
      programResult,
      publicationResult,
      contributorResult,
      assignmentResult,
    ].find((result) => result.error)?.error;
    if (firstError) setError(firstError.message);
    const nextProfiles = (profileResult.data ?? []) as Profile[];
    setProfiles(nextProfiles);
    setPrograms((programResult.data ?? []) as Program[]);
    setPublications((publicationResult.data ?? []) as Publication[]);
    setContributors((contributorResult.data ?? []) as Contributor[]);
    setAssignments((assignmentResult.data ?? []) as Assignment[]);
    setProgramForm((current) => ({
      ...current,
      hostId: current.hostId || auth.data.user?.id || nextProfiles[0]?.id || "",
    }));
    setLoading(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void load();
  }, [load]);
  function start() {
    setWorking(true);
    setNotice("");
    setError("");
  }
  function finish(message: string) {
    setWorking(false);
    setNotice(message);
    void load();
  }
  function fail(message: string) {
    setWorking(false);
    setError(message);
  }

  async function createProgram(event: FormEvent) {
    event.preventDefault();
    start();
    const { error: writeError } = await supabase
      .from("floor_live_programs")
      .insert({
        title: programForm.title.trim(),
        format: programForm.format,
        description: programForm.description.trim(),
        focus: programForm.focus.trim(),
        starts_at: new Date(programForm.startsAt).toISOString(),
        duration_minutes: Number(programForm.duration),
        host_id: programForm.hostId,
        meeting_url: programForm.meetingUrl.trim() || null,
        status: "scheduled",
      });
    if (writeError) return fail(writeError.message);
    setProgramForm((v) => ({
      ...v,
      title: "",
      description: "",
      focus: "",
      startsAt: "",
      meetingUrl: "",
    }));
    finish("Live session scheduled.");
  }
  async function setProgramStatus(id: string, status: string) {
    start();
    const patch: Record<string, unknown> = { status };
    if (status === "completed") {
      const replay =
        window
          .prompt("Replay URL (leave blank if no recording exists):")
          ?.trim() || null;
      const summary =
        window.prompt("Replay summary (optional):")?.trim() || null;
      patch.replay_url = replay;
      patch.replay_summary = summary;
    }
    const { error: writeError } = await supabase
      .from("floor_live_programs")
      .update(patch)
      .eq("id", id);
    if (writeError) return fail(writeError.message);
    finish(`Session marked ${status}.`);
  }

  async function savePublication(event: FormEvent) {
    event.preventDefault();
    start();
    const status = publicationForm.status;
    if (!adminId) return fail("Administrator identity is unavailable.");
    const sources = publicationForm.sources
      .split("\n")
      .map((source) => source.trim())
      .filter(Boolean)
      .map((url) => ({ url }));
    const payload = {
      slug: publicationForm.slug || slugify(publicationForm.title),
      publication_type: publicationForm.type,
      title: publicationForm.title.trim(),
      excerpt: publicationForm.excerpt.trim(),
      body: publicationForm.body.trim(),
      tickers: publicationForm.tickers
        .split(",")
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean),
      sources,
      author_id: null,
      reviewer_id: adminId,
      public_byline: "Loombus Research Desk",
      public_approval_label: "Loombus",
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    };
    const { data: publication, error: writeError } = await supabase
      .from("floor_research_publications")
      .insert(payload)
      .select("id")
      .single();
    if (writeError) return fail(writeError.message);
    const { error: provenanceError } = await supabase
      .from("floor_research_publication_provenance")
      .insert({
        publication_id: publication.id,
        generation_method: publicationForm.aiAssisted
          ? "ai_generated"
          : "human",
        model_provider: publicationForm.modelProvider || null,
        model_name: publicationForm.modelName || null,
        prompt_version: publicationForm.promptVersion || null,
        generated_at: publicationForm.aiAssisted
          ? new Date().toISOString()
          : null,
        created_by: adminId,
        approved_by: status === "published" ? adminId : null,
        approved_at: status === "published" ? new Date().toISOString() : null,
      });
    if (provenanceError) {
      await supabase
        .from("floor_research_publications")
        .delete()
        .eq("id", publication.id);
      return fail(provenanceError.message);
    }
    setPublicationForm((v) => ({
      ...v,
      title: "",
      slug: "",
      excerpt: "",
      body: "",
      tickers: "",
      sources: "",
      researchFocus: "",
      status: "draft",
      aiAssisted: false,
      modelProvider: "",
      modelName: "",
      promptVersion: "",
    }));
    finish(
      status === "published"
        ? "Research publication published."
        : "Research draft saved.",
    );
  }
  async function generateResearchDraft() {
    if (
      !publicationForm.title.trim() ||
      !publicationForm.researchFocus.trim()
    ) {
      setError("Add a working title and research brief first.");
      return;
    }
    setResearching(true);
    setNotice("");
    setError("");
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      setResearching(false);
      setError("Your administrator session has expired.");
      return;
    }
    try {
      const response = await fetch("/api/admin/floor/research-draft", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: publicationForm.title,
          focus: publicationForm.researchFocus,
          publicationType: publicationForm.type,
          tickers: publicationForm.tickers,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        draft?: {
          title: string;
          excerpt: string;
          body: string;
          tickers: string[];
          sources: Array<{ url: string }>;
        };
        provenance?: {
          provider: string;
          model: string;
          promptVersion: string;
        };
      };
      if (!response.ok || !result.draft || !result.provenance) {
        throw new Error(
          result.error || "Unable to prepare the research draft.",
        );
      }
      setPublicationForm((current) => ({
        ...current,
        title: result.draft!.title,
        slug: slugify(result.draft!.title),
        excerpt: result.draft!.excerpt,
        body: result.draft!.body,
        tickers: result.draft!.tickers.join(", "),
        sources: result.draft!.sources.map((source) => source.url).join("\n"),
        aiAssisted: true,
        modelProvider: result.provenance!.provider,
        modelName: result.provenance!.model,
        promptVersion: result.provenance!.promptVersion,
        status: "draft",
      }));
      setNotice(
        "Research draft prepared. Verify every claim and source before sending it to review.",
      );
    } catch (draftError) {
      setError(
        draftError instanceof Error
          ? draftError.message
          : "Unable to prepare the research draft.",
      );
    } finally {
      setResearching(false);
    }
  }
  async function updatePublication(id: string, status: string) {
    start();
    const item = publications.find((p) => p.id === id);
    if (!item) return fail("Publication was not found.");
    if (!adminId) return fail("Administrator identity is unavailable.");
    const { error: writeError } = await supabase
      .from("floor_research_publications")
      .update({
        status,
        reviewer_id: adminId,
        published_at: status === "published" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (writeError) return fail(writeError.message);
    if (status === "published") {
      const { error: provenanceError } = await supabase
        .from("floor_research_publication_provenance")
        .update({
          approved_by: adminId,
          approved_at: new Date().toISOString(),
        })
        .eq("publication_id", id);
      if (provenanceError) {
        await supabase
          .from("floor_research_publications")
          .update({ status: "review", published_at: null })
          .eq("id", id);
        return fail(provenanceError.message);
      }
    }
    finish(`Publication moved to ${status}.`);
  }

  async function updateContributor(userId: string, status: string) {
    start();
    const { error: writeError } = await supabase
      .from("floor_contributor_profiles")
      .update({
        status,
        accepted_at: status === "active" ? new Date().toISOString() : null,
      })
      .eq("user_id", userId);
    if (writeError) return fail(writeError.message);
    finish(`Contributor marked ${status}.`);
  }
  async function createAssignment(event: FormEvent) {
    event.preventDefault();
    start();
    const { error: writeError } = await supabase
      .from("floor_contributor_assignments")
      .insert({
        contributor_id: assignmentForm.contributorId,
        title: assignmentForm.title.trim(),
        focus: assignmentForm.focus.trim(),
        due_at: new Date(assignmentForm.dueAt).toISOString(),
        publication_id: assignmentForm.publicationId || null,
        status: "assigned",
      });
    if (writeError) return fail(writeError.message);
    setAssignmentForm((v) => ({
      ...v,
      title: "",
      focus: "",
      dueAt: "",
      publicationId: "",
    }));
    finish("Editorial assignment created.");
  }
  if (loading)
    return (
      <LoombusLoadingScreen
        title="Opening Floor operations..."
        message="Verifying administrator access and loading editorial records."
      />
    );
  if (!allowed) return null;
  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-6 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className={card}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-[var(--loombus-gold)]">
                Administrator only
              </p>
              <h1 className="mt-2 text-3xl font-black">
                The Floor Operations Desk
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                Operate real programming, reviewed research, and contributor
                assignments. Nothing created here becomes a house rating or
                fabricated member activity.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/the-floor"
                className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-xs font-black"
              >
                Open The Floor
              </Link>
              <button
                onClick={() => void load()}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-xs font-black"
              >
                <RefreshCw className="size-4" />
                Refresh
              </button>
            </div>
          </div>
          <nav className="mt-5 flex gap-2 overflow-x-auto">
            {(
              [
                ["programming", "Live programming", Radio],
                ["research", "Research Desk", FilePenLine],
                ["contributors", "Contributors", UserRoundCheck],
              ] as const
            ).map(([id, text, Icon]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-black ${view === id ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`}
              >
                <Icon className="size-4" />
                {text}
              </button>
            ))}
          </nav>
          {notice ? (
            <p className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-sm font-bold text-emerald-500">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm font-bold text-rose-500"
            >
              {error}
            </p>
          ) : null}
        </header>

        {view === "programming" ? (
          <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
            <form onSubmit={createProgram} className={card}>
              <CalendarPlus className="size-5 text-[var(--loombus-gold)]" />
              <h2 className="mt-3 text-lg font-black">
                Schedule a hosted session
              </h2>
              <div className="mt-4 space-y-3">
                <label className={label}>
                  Title
                  <input
                    required
                    value={programForm.title}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, title: e.target.value })
                    }
                    className={input}
                  />
                </label>
                <label className={label}>
                  Format
                  <select
                    value={programForm.format}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, format: e.target.value })
                    }
                    className={input}
                  >
                    {[
                      "opening_bell",
                      "research_room",
                      "earnings_debrief",
                      "office_hours",
                      "workshop",
                    ].map((x) => (
                      <option key={x} value={x}>
                        {x.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Host
                  <select
                    required
                    value={programForm.hostId}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, hostId: e.target.value })
                    }
                    className={input}
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {name(p)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Start time
                  <input
                    required
                    type="datetime-local"
                    value={programForm.startsAt}
                    onChange={(e) =>
                      setProgramForm({
                        ...programForm,
                        startsAt: e.target.value,
                      })
                    }
                    className={input}
                  />
                </label>
                <label className={label}>
                  Duration in minutes
                  <input
                    required
                    type="number"
                    min="15"
                    max="240"
                    value={programForm.duration}
                    onChange={(e) =>
                      setProgramForm({
                        ...programForm,
                        duration: e.target.value,
                      })
                    }
                    className={input}
                  />
                </label>
                <label className={label}>
                  Focus
                  <input
                    value={programForm.focus}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, focus: e.target.value })
                    }
                    className={input}
                  />
                </label>
                <label className={label}>
                  Description
                  <textarea
                    required
                    rows={4}
                    value={programForm.description}
                    onChange={(e) =>
                      setProgramForm({
                        ...programForm,
                        description: e.target.value,
                      })
                    }
                    className={`${input} py-3`}
                  />
                </label>
                <label className={label}>
                  Meeting URL
                  <input
                    type="url"
                    value={programForm.meetingUrl}
                    onChange={(e) =>
                      setProgramForm({
                        ...programForm,
                        meetingUrl: e.target.value,
                      })
                    }
                    className={input}
                  />
                </label>
                <button disabled={working} className={gold}>
                  Schedule session
                </button>
              </div>
            </form>
            <div className="space-y-3">
              {programs.map((p) => (
                <article key={p.id} className={card}>
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase text-[var(--loombus-gold)]">
                        {p.format.replaceAll("_", " ")} · {p.status}
                      </p>
                      <h3 className="mt-1 font-black">{p.title}</h3>
                      <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">
                        {localDate(p.starts_at)} · {p.duration_minutes} min ·{" "}
                        {name(profileMap.get(p.host_id))}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {p.status === "scheduled" ? (
                        <button
                          disabled={working}
                          onClick={() => void setProgramStatus(p.id, "live")}
                          className={gold}
                        >
                          Go live
                        </button>
                      ) : null}
                      {p.status !== "completed" && p.status !== "cancelled" ? (
                        <button
                          disabled={working}
                          onClick={() =>
                            void setProgramStatus(p.id, "completed")
                          }
                          className="rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs font-black"
                        >
                          Complete
                        </button>
                      ) : null}
                      {p.status !== "cancelled" ? (
                        <button
                          disabled={working}
                          onClick={() =>
                            void setProgramStatus(p.id, "cancelled")
                          }
                          className="rounded-full border border-rose-500/40 px-3 py-2 text-xs font-black text-rose-500"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {p.description ? (
                    <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
                      {p.description}
                    </p>
                  ) : null}
                  {p.replay_url ? (
                    <a
                      href={p.replay_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-xs font-black text-[var(--loombus-gold)]"
                    >
                      Open replay
                    </a>
                  ) : null}
                </article>
              ))}
              {!programs.length ? (
                <div className={card}>No sessions have been scheduled.</div>
              ) : null}
            </div>
          </section>
        ) : null}

        {view === "research" ? (
          <section className="grid gap-5 lg:grid-cols-[420px_1fr]">
            <form onSubmit={savePublication} className={card}>
              <FilePenLine className="size-5 text-[var(--loombus-gold)]" />
              <h2 className="mt-3 text-lg font-black">
                Create a Research Desk issue
              </h2>
              <div className="mt-4 space-y-3">
                <label className={label}>
                  Title
                  <input
                    required
                    value={publicationForm.title}
                    onChange={(e) =>
                      setPublicationForm({
                        ...publicationForm,
                        title: e.target.value,
                        slug: publicationForm.slug || slugify(e.target.value),
                      })
                    }
                    className={input}
                  />
                </label>
                <label className={label}>
                  Slug
                  <input
                    required
                    value={publicationForm.slug}
                    onChange={(e) =>
                      setPublicationForm({
                        ...publicationForm,
                        slug: slugify(e.target.value),
                      })
                    }
                    className={input}
                  />
                </label>
                <label className={label}>
                  Type
                  <select
                    value={publicationForm.type}
                    onChange={(e) =>
                      setPublicationForm({
                        ...publicationForm,
                        type: e.target.value,
                      })
                    }
                    className={input}
                  >
                    {[
                      "daily_briefing",
                      "weekly_outlook",
                      "earnings_preview",
                      "earnings_review",
                      "company_dossier",
                      "sector_watch",
                      "bull_bear",
                      "what_changed",
                      "monthly_accountability",
                    ].map((x) => (
                      <option key={x} value={x}>
                        {x.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Research brief
                  <textarea
                    rows={4}
                    value={publicationForm.researchFocus}
                    onChange={(e) =>
                      setPublicationForm({
                        ...publicationForm,
                        researchFocus: e.target.value,
                      })
                    }
                    placeholder="State the question, time horizon, claims to test, and evidence the draft should examine."
                    className={`${input} py-3`}
                  />
                </label>
                <button
                  type="button"
                  disabled={researching || working}
                  onClick={() => void generateResearchDraft()}
                  className={gold}
                >
                  {researching
                    ? "Loombus is researching…"
                    : "Prepare research draft"}
                </button>
                <p className="text-xs leading-5 text-[var(--loombus-text-muted)]">
                  Searches current public sources and prepares an unpublished
                  draft. You remain responsible for checking every claim and
                  source before approval.
                </p>
                <div className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-3 text-xs leading-5 text-[var(--loombus-text-muted)]">
                  <strong className="text-[var(--loombus-text)]">
                    Public attribution
                  </strong>
                  <p>Prepared by Loombus Research Desk</p>
                  <p>Approved by Loombus</p>
                  <p className="mt-2">
                    Your administrator identity is retained privately in the
                    approval audit record.
                  </p>
                </div>
                <label className={label}>
                  Excerpt
                  <textarea
                    required
                    rows={3}
                    value={publicationForm.excerpt}
                    onChange={(e) =>
                      setPublicationForm({
                        ...publicationForm,
                        excerpt: e.target.value,
                      })
                    }
                    className={`${input} py-3`}
                  />
                </label>
                <label className={label}>
                  Publication body
                  <textarea
                    required
                    rows={10}
                    value={publicationForm.body}
                    onChange={(e) =>
                      setPublicationForm({
                        ...publicationForm,
                        body: e.target.value,
                      })
                    }
                    className={`${input} py-3`}
                  />
                </label>
                <label className={label}>
                  Tickers, comma separated
                  <input
                    value={publicationForm.tickers}
                    onChange={(e) =>
                      setPublicationForm({
                        ...publicationForm,
                        tickers: e.target.value,
                      })
                    }
                    className={input}
                  />
                </label>
                <label className={label}>
                  Source URLs, one per line
                  <textarea
                    rows={4}
                    value={publicationForm.sources}
                    onChange={(e) =>
                      setPublicationForm({
                        ...publicationForm,
                        sources: e.target.value,
                      })
                    }
                    className={`${input} py-3`}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-black">
                  <input
                    type="checkbox"
                    checked={publicationForm.aiAssisted}
                    onChange={(e) =>
                      setPublicationForm({
                        ...publicationForm,
                        aiAssisted: e.target.checked,
                      })
                    }
                  />{" "}
                  AI prepared the initial draft (internal provenance only)
                </label>
                <label className={label}>
                  Save as
                  <select
                    value={publicationForm.status}
                    onChange={(e) =>
                      setPublicationForm({
                        ...publicationForm,
                        status: e.target.value,
                      })
                    }
                    className={input}
                  >
                    <option value="draft">Draft</option>
                    <option value="review">In review</option>
                    <option value="published">Published</option>
                  </select>
                </label>
                <button disabled={working} className={gold}>
                  Save publication
                </button>
              </div>
            </form>
            <div className="space-y-3">
              {publications.map((p) => (
                <article key={p.id} className={card}>
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase text-[var(--loombus-gold)]">
                        {p.publication_type.replaceAll("_", " ")} · {p.status}
                      </p>
                      <h3 className="mt-1 font-black">{p.title}</h3>
                      <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">
                        Prepared by {p.public_byline} · Approved by{" "}
                        {p.public_approval_label} · {p.sources.length} sources
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {p.status === "draft" ? (
                        <button
                          disabled={working}
                          onClick={() => void updatePublication(p.id, "review")}
                          className="rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs font-black"
                        >
                          Send to review
                        </button>
                      ) : null}
                      {p.status === "review" ? (
                        <button
                          disabled={working}
                          onClick={() =>
                            void updatePublication(p.id, "published")
                          }
                          className={gold}
                        >
                          Publish
                        </button>
                      ) : null}
                      {p.status === "published" ? (
                        <button
                          disabled={working}
                          onClick={() =>
                            void updatePublication(p.id, "archived")
                          }
                          className="rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs font-black"
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {p.excerpt}
                  </p>
                </article>
              ))}
              {!publications.length ? (
                <div className={card}>
                  No research issues have been drafted.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {view === "contributors" ? (
          <section className="grid gap-5 lg:grid-cols-[1fr_380px]">
            <div className="space-y-3">
              {contributors.map((c) => (
                <article key={c.user_id} className={card}>
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase text-[var(--loombus-gold)]">
                        {c.status} · {c.target_cadence}
                      </p>
                      <h3 className="mt-1 font-black">
                        {name(profileMap.get(c.user_id))}
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-[var(--loombus-text-muted)]">
                        {c.disclosure || "No disclosure supplied."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {c.status !== "active" ? (
                        <button
                          disabled={working}
                          onClick={() =>
                            void updateContributor(c.user_id, "active")
                          }
                          className={gold}
                        >
                          Accept
                        </button>
                      ) : (
                        <button
                          disabled={working}
                          onClick={() =>
                            void updateContributor(c.user_id, "paused")
                          }
                          className="rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs font-black"
                        >
                          Pause
                        </button>
                      )}
                      {c.status === "applicant" ? (
                        <button
                          disabled={working}
                          onClick={() =>
                            void updateContributor(c.user_id, "declined")
                          }
                          className="rounded-full border border-rose-500/40 px-3 py-2 text-xs font-black text-rose-500"
                        >
                          Decline
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assignments
                      .filter((a) => a.contributor_id === c.user_id)
                      .map((a) => (
                        <span
                          key={a.id}
                          className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-bold"
                        >
                          {a.title} · {a.status} · due{" "}
                          {new Date(a.due_at).toLocaleDateString()}
                        </span>
                      ))}
                  </div>
                </article>
              ))}
              {!contributors.length ? (
                <div className={card}>
                  No contributor applications have been submitted.
                </div>
              ) : null}
            </div>
            <form onSubmit={createAssignment} className={card}>
              <UserRoundCheck className="size-5 text-[var(--loombus-gold)]" />
              <h2 className="mt-3 text-lg font-black">
                Create editorial assignment
              </h2>
              <div className="mt-4 space-y-3">
                <label className={label}>
                  Active contributor
                  <select
                    required
                    value={assignmentForm.contributorId}
                    onChange={(e) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        contributorId: e.target.value,
                      })
                    }
                    className={input}
                  >
                    <option value="">Select contributor</option>
                    {contributors
                      .filter((c) => c.status === "active")
                      .map((c) => (
                        <option key={c.user_id} value={c.user_id}>
                          {name(profileMap.get(c.user_id))}
                        </option>
                      ))}
                  </select>
                </label>
                <label className={label}>
                  Assignment title
                  <input
                    required
                    value={assignmentForm.title}
                    onChange={(e) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        title: e.target.value,
                      })
                    }
                    className={input}
                  />
                </label>
                <label className={label}>
                  Focus
                  <input
                    value={assignmentForm.focus}
                    onChange={(e) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        focus: e.target.value,
                      })
                    }
                    className={input}
                  />
                </label>
                <label className={label}>
                  Due date
                  <input
                    required
                    type="datetime-local"
                    value={assignmentForm.dueAt}
                    onChange={(e) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        dueAt: e.target.value,
                      })
                    }
                    className={input}
                  />
                </label>
                <label className={label}>
                  Link a publication, optional
                  <select
                    value={assignmentForm.publicationId}
                    onChange={(e) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        publicationId: e.target.value,
                      })
                    }
                    className={input}
                  >
                    <option value="">No publication</option>
                    {publications.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={working} className={gold}>
                  Create assignment
                </button>
              </div>
            </form>
          </section>
        ) : null}
        <footer className={card}>
          <p className="flex gap-2 text-xs leading-5 text-[var(--loombus-text-muted)]">
            <ShieldCheck className="size-4 shrink-0 text-[var(--loombus-gold)]" />
            Administrator access is enforced twice: this page verifies the
            signed-in profile, and Supabase row-level security independently
            rejects unauthorized writes.
          </p>
        </footer>
      </div>
    </main>
  );
}
