"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { supabase } from "@/lib/supabase/client";
import { analystPath } from "@/lib/floor-credibility";
import { floorDisplayName } from "@/lib/floor-shared";
import {
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  FileSearch,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Program = {
  id: string;
  title: string;
  format: string;
  description: string;
  focus: string;
  starts_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  replay_url: string | null;
  replay_summary: string | null;
  status: string;
  host:
    | { full_name: string | null; username: string | null }
    | { full_name: string | null; username: string | null }[]
    | null;
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
  public_byline: string;
  public_approval_label: string;
  published_at: string;
};
type Activity = {
  id: string;
  ticker: string;
  thesis: string;
  created_at: string;
  author:
    | { id: string; full_name: string | null; username: string | null }
    | { id: string; full_name: string | null; username: string | null }[]
    | null;
};
type Track = {
  member_id: string;
  full_name: string | null;
  username: string | null;
  resolved_calls: number;
  correct_calls: number;
  incorrect_calls: number;
  partial_calls: number;
  pending_calls: number;
  accuracy_pct: number | string | null;
};
type Contributor = {
  status: string;
  specialties: string[];
  disclosure: string;
  target_cadence: string;
};
type View = "live" | "research" | "analysts" | "track";

const card =
  "rounded-[1.35rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5";
const label =
  "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]";
function profileName(value: Program["host"]) {
  const item = Array.isArray(value) ? value[0] : value;
  return floorDisplayName(item?.full_name, item?.username);
}
function activityProfile(value: Activity["author"]) {
  return Array.isArray(value) ? value[0] : value;
}
function cadenceState(date: string) {
  const days = Math.floor((Date.now() - Date.parse(date)) / 86400000);
  return days <= 7
    ? "On cadence"
    : days <= 30
      ? "Due for an update"
      : "Inactive 30+ days";
}

export default function TheFloorProgramCenter({
  initialView = "live",
}: {
  initialView?: View;
}) {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>(initialView);
  const [userId, setUserId] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [registrations, setRegistrations] = useState<string[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [contributor, setContributor] = useState<Contributor | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const auth = await supabase.auth.getUser();
    const user = auth.data.user;
    if (!user) {
      window.location.replace("/login?next=%2Fthe-floor%2Flive");
      return;
    }
    setUserId(user.id);
    const [
      programResult,
      registrationResult,
      publicationResult,
      activityResult,
      trackResult,
      contributorResult,
    ] = await Promise.all([
      supabase
        .from("floor_live_programs")
        .select(
          "id,title,format,description,focus,starts_at,duration_minutes,meeting_url,replay_url,replay_summary,status,host:profiles!floor_live_programs_host_id_fkey(full_name,username)",
        )
        .order("starts_at", { ascending: true })
        .limit(100),
      supabase
        .from("floor_live_registrations")
        .select("program_id")
        .eq("user_id", user.id),
      supabase
        .from("floor_research_publications")
        .select(
          "id,slug,publication_type,title,excerpt,body,tickers,sources,public_byline,public_approval_label,published_at",
        )
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(60),
      supabase
        .from("floor_theses")
        .select(
          "id,ticker,thesis,created_at,author:profiles!floor_theses_author_id_fkey(id,full_name,username)",
        )
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("floor_member_credibility")
        .select(
          "member_id,full_name,username,resolved_calls,correct_calls,incorrect_calls,partial_calls,pending_calls,accuracy_pct",
        )
        .order("resolved_calls", { ascending: false })
        .limit(50),
      supabase
        .from("floor_contributor_profiles")
        .select("status,specialties,disclosure,target_cadence")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    setPrograms((programResult.data ?? []) as unknown as Program[]);
    setRegistrations(
      (registrationResult.data ?? []).map((row) => row.program_id),
    );
    setPublications((publicationResult.data ?? []) as unknown as Publication[]);
    setActivity((activityResult.data ?? []) as unknown as Activity[]);
    setTracks((trackResult.data ?? []) as Track[]);
    setContributor((contributorResult.data as Contributor | null) ?? null);
    setLoading(false);
  }, []);
  // Loading remote program state is the effect's external synchronization boundary.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void load();
  }, [load]);

  const analysts = useMemo(() => {
    const grouped = new Map<
      string,
      { profile: ReturnType<typeof activityProfile>; items: Activity[] }
    >();
    for (const item of activity) {
      const p = activityProfile(item.author);
      if (!p) continue;
      const old = grouped.get(p.id);
      grouped.set(p.id, { profile: p, items: [...(old?.items ?? []), item] });
    }
    return [...grouped.values()].sort(
      (a, b) =>
        Date.parse(b.items[0].created_at) - Date.parse(a.items[0].created_at),
    );
  }, [activity]);
  async function toggleRegistration(id: string) {
    if (!userId) return;
    if (registrations.includes(id)) {
      await supabase
        .from("floor_live_registrations")
        .delete()
        .eq("program_id", id)
        .eq("user_id", userId);
      setRegistrations((v) => v.filter((x) => x !== id));
      setNotice("Registration removed.");
    } else {
      const { error } = await supabase
        .from("floor_live_registrations")
        .insert({ program_id: id, user_id: userId, reminder_minutes: 30 });
      if (!error) {
        setRegistrations((v) => [...v, id]);
        setNotice(
          "Registered. The session will appear in your Floor schedule.",
        );
      }
    }
  }
  async function applyContributor() {
    if (!userId) return;
    const { error } = await supabase.from("floor_contributor_profiles").upsert(
      {
        user_id: userId,
        status: "applicant",
        specialties: [],
        disclosure: "No conflicts disclosed yet.",
        target_cadence: "weekly",
      },
      { onConflict: "user_id" },
    );
    if (!error) {
      setContributor({
        status: "applicant",
        specialties: [],
        disclosure: "No conflicts disclosed yet.",
        target_cadence: "weekly",
      });
      setNotice(
        "Application received. Editorial review is required before assignments begin.",
      );
    }
  }
  if (loading)
    return (
      <LoombusLoadingScreen
        title="Opening Floor programming..."
        message="Loading live sessions, reviewed research, analyst cadence, and resolved records."
      />
    );
  const upcoming = programs.filter(
      (p) => p.status === "scheduled" || p.status === "live",
    ),
    replays = programs.filter((p) => p.status === "completed" && p.replay_url);
  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className={card}>
          <p className={label}>The Floor operating program</p>
          <h1 className="mt-2 text-3xl font-black">
            Research that returns on a schedule.
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
            Join attributable live sessions, read reviewed member research,
            follow real analyst publishing cadence, and inspect resolved calls
            without popularity or simulated activity.
          </p>
          <nav className="mt-5 flex gap-2 overflow-x-auto">
            {(
              [
                ["live", "Live programming", Radio],
                ["research", "Research Desk", FileSearch],
                ["analysts", "Analyst cadence", Users],
                ["track", "Track records", ShieldCheck],
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
            <p
              role="status"
              className="mt-4 rounded-xl bg-[var(--loombus-gold-surface)] p-3 text-sm font-bold"
            >
              {notice}
            </p>
          ) : null}
        </header>
        {view === "live" ? (
          <section className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <div className="space-y-4">
              <div>
                <p className={label}>Upcoming</p>
                <h2 className="mt-1 text-xl font-black">Live Floor schedule</h2>
              </div>
              {upcoming.length ? (
                upcoming.map((p) => (
                  <article key={p.id} className={card}>
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <p className={label}>
                          {p.format.replaceAll("_", " ")} · {p.status}
                        </p>
                        <h3 className="mt-1 text-lg font-black">{p.title}</h3>
                      </div>
                      <time className="text-right text-xs font-black">
                        {new Date(p.starts_at).toLocaleString()}
                        <br />
                        {p.duration_minutes} minutes
                      </time>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
                      {p.description}
                    </p>
                    <p className="mt-2 text-xs font-bold">
                      Hosted by {profileName(p.host)}
                      {p.focus ? ` · ${p.focus}` : ""}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => void toggleRegistration(p.id)}
                        className="rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-xs font-black text-black"
                      >
                        {registrations.includes(p.id)
                          ? "Registered — remove"
                          : "Register"}
                      </button>
                      {p.status === "live" && p.meeting_url ? (
                        <a
                          href={p.meeting_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-xs font-black"
                        >
                          Join live
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <div className={card}>
                  <Clock3 className="size-6 text-[var(--loombus-gold)]" />
                  <h3 className="mt-3 font-black">
                    No hosted session is scheduled yet
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                    The calendar stays empty until a real host, start time, and
                    session format are confirmed.
                  </p>
                </div>
              )}
            </div>
            <aside className="space-y-4">
              <div className={card}>
                <BookOpenCheck className="size-5 text-[var(--loombus-gold)]" />
                <h3 className="mt-3 font-black">Programming standard</h3>
                <p className="mt-2 text-xs leading-5 text-[var(--loombus-text-muted)]">
                  Every listing names a host. Completed sessions only become
                  replays when a real recording or written summary exists.
                </p>
              </div>
              <div className={card}>
                <p className={label}>Replay library</p>
                <p className="mt-2 text-3xl font-black">{replays.length}</p>
                <p className="text-xs text-[var(--loombus-text-muted)]">
                  completed sessions with a replay
                </p>
              </div>
            </aside>
          </section>
        ) : null}
        {view === "research" ? (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className={label}>Member-only editorial</p>
                <h2 className="mt-1 text-xl font-black">Research Desk</h2>
              </div>
              <span className="text-xs font-bold text-[var(--loombus-text-muted)]">
                {publications.length} reviewed publications
              </span>
            </div>
            {publications.length ? (
              publications.map((p) => (
                <article key={p.id} className={card}>
                  <p className={label}>
                    {p.publication_type.replaceAll("_", " ")}
                  </p>
                  <h3 className="mt-2 text-xl font-black">{p.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {p.excerpt}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.tickers.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-[var(--loombus-gold-surface)] px-2 py-1 text-xs font-black"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-xs font-bold">
                    Prepared by {p.public_byline} · Approved by{" "}
                    {p.public_approval_label} · {p.sources.length} disclosed
                    sources
                  </p>
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-black text-[var(--loombus-gold)]">
                      Read publication
                    </summary>
                    <div className="mt-3 whitespace-pre-wrap border-t border-[var(--loombus-border)] pt-4 text-sm leading-7">
                      {p.body}
                    </div>
                  </details>
                </article>
              ))
            ) : (
              <div className={card}>
                <FileSearch className="size-6 text-[var(--loombus-gold)]" />
                <h3 className="mt-3 font-black">
                  Editorial desk is ready; no reviewed issue has been published
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                  Drafts cannot appear here. Publication requires Loombus
                  review, disclosed sources, and an accountable internal
                  approval record.
                </p>
              </div>
            )}
          </section>
        ) : null}
        {view === "analysts" ? (
          <section className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <div className="space-y-3">
              {analysts.map(({ profile, items }) => (
                <Link
                  key={profile?.id}
                  href={analystPath(profile?.id ?? "")}
                  className={`${card} block`}
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <h3 className="font-black">
                        {floorDisplayName(
                          profile?.full_name,
                          profile?.username,
                        )}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">
                        Latest: {items[0].ticker} ·{" "}
                        {new Date(items[0].created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="h-fit rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-black">
                      {cadenceState(items[0].created_at)}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {items[0].thesis}
                  </p>
                </Link>
              ))}
            </div>
            <aside className={card}>
              <Users className="size-5 text-[var(--loombus-gold)]" />
              <h3 className="mt-3 font-black">Contributor program</h3>
              <p className="mt-2 text-xs leading-5 text-[var(--loombus-text-muted)]">
                Accepted contributors receive an explicit publishing cadence and
                editorial assignments. Missed cadence remains visible; activity
                is never backfilled.
              </p>
              {contributor ? (
                <div className="mt-4 rounded-xl bg-[var(--loombus-surface-muted)] p-3">
                  <p className={label}>Your status</p>
                  <p className="mt-1 font-black capitalize">
                    {contributor.status}
                  </p>
                  <p className="mt-1 text-xs">
                    Target: {contributor.target_cadence}
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => void applyContributor()}
                  className="mt-4 rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-xs font-black text-black"
                >
                  Apply to contribute
                </button>
              )}
            </aside>
          </section>
        ) : null}
        {view === "track" ? (
          <section className="space-y-4">
            <div className={card}>
              <div className="flex gap-3">
                <ShieldCheck className="size-6 shrink-0 text-[var(--loombus-gold)]" />
                <div>
                  <h2 className="font-black">
                    Resolved means measured after the deadline
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                    Calls are defined before the result, become immutable, and
                    are resolved as correct, incorrect, or partial against their
                    stated criteria. Accuracy excludes partial outcomes and
                    never includes likes or followers.
                  </p>
                </div>
              </div>
            </div>
            {tracks.length ? (
              tracks.map((r) => (
                <Link
                  key={r.member_id}
                  href={analystPath(r.member_id)}
                  className={`${card} grid gap-3 sm:grid-cols-[1fr_repeat(3,110px)] sm:items-center`}
                >
                  <div>
                    <h3 className="font-black">
                      {floorDisplayName(r.full_name, r.username)}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">
                      {r.pending_calls} pending calls remain unresolved
                    </p>
                  </div>
                  <div>
                    <p className={label}>Resolved</p>
                    <b>{r.resolved_calls}</b>
                  </div>
                  <div>
                    <p className={label}>Correct</p>
                    <b>{r.correct_calls}</b>
                  </div>
                  <div>
                    <p className={label}>Accuracy</p>
                    <b>
                      {r.accuracy_pct === null
                        ? "—"
                        : `${Math.round(Number(r.accuracy_pct))}%`}
                    </b>
                  </div>
                </Link>
              ))
            ) : (
              <div className={card}>
                <CheckCircle2 className="size-6 text-[var(--loombus-gold)]" />
                <h3 className="mt-3 font-black">
                  No calls have reached resolution yet
                </h3>
                <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
                  Records will appear automatically when measurable call
                  deadlines pass and outcomes are resolved.
                </p>
              </div>
            )}
          </section>
        ) : null}
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={label}>Structured learning</p>
              <h2 className="mt-1 font-black">Complete The Floor Academy</h2>
            </div>
            <Link
              href="/the-floor/academy"
              className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-xs font-black"
            >
              Open curriculum →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
