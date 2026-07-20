"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  ChevronRight,
  Clock3,
  Compass,
  Layers3,
  Loader2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import type { ChangeEvent } from "react";
import {
  EverythingSearchAi,
  EverythingSearchBrief,
  EverythingSearchResultCard,
} from "./everything-search-components";
import { GROUP_LABELS } from "./everything-search-model";
import { useEverythingSearch } from "./use-everything-search";

const destinationLinks = [
  ["Discussions", "/discussions"],
  ["People", "/people"],
  ["Services", "/services"],
  ["Requests", "/requests"],
  ["Marketplace", "/marketplace"],
  ["Saved", "/saved"],
] as const;

export default function SearchPage() {
  const state = useEverythingSearch();
  const aiBusy = state.aiQueued || state.aiWorking;
  const resultCount = state.search.results.length;

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[86rem]">
        <header className="mb-6 max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
            Everything Search
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
            Search once. Find the right signal.
          </h1>
          <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
            Search the Loombus index across discussions, replies, people, permitted Room content, Services, Requests, Jobs, Events, Marketplace, saved items, files, and platform destinations.
          </p>
        </header>

        <section className="mb-6 rounded-[1.8rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-4 text-[color:var(--loombus-cream-contrast)] shadow-xl shadow-black/10 dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)] sm:p-5">
          <form
            onSubmit={state.submit}
            className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"
          >
            <label className="relative block min-w-0">
              <span className="sr-only">Search everything in Loombus</span>
              <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--loombus-gold)]" />
              <input
                type="search"
                value={state.query}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  state.setQuery(event.target.value)
                }
                placeholder="Search a question, person, Service, Request, Job, Event, or page"
                className="h-14 w-full rounded-2xl border border-black/10 bg-white/75 pl-14 pr-12 text-base text-[#17140b] outline-none transition placeholder:text-black/45 focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-white/40 dark:border-white/10 dark:bg-black/15 dark:text-[color:var(--loombus-text)] dark:placeholder:text-white/45 dark:focus:ring-black/10"
              />
              {state.query ? (
                <button
                  type="button"
                  aria-label="Clear search field"
                  onClick={() => state.setQuery("")}
                  className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-black/55 transition hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X size={17} />
                </button>
              ) : null}
            </label>
            <button
              type="submit"
              disabled={state.query.trim().length < 2 || aiBusy}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[color:var(--loombus-gold)] px-6 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-45"
            >
              Search <ArrowRight size={17} />
            </button>
            <button
              type="button"
              onClick={state.askAiFromInput}
              disabled={state.query.trim().length < 2 || aiBusy}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/55 px-6 text-sm font-semibold transition hover:bg-white/80 disabled:opacity-45 dark:border-white/10 dark:bg-black/10 dark:hover:bg-black/20"
            >
              {aiBusy ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <Sparkles size={17} />
              )}
              {state.aiQueued
                ? "Finding sources…"
                : state.aiWorking
                  ? "Organizing…"
                  : "Ask Loombus AI"}
            </button>
          </form>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs opacity-75">
            <span>Enter at least two characters. Search terms stay in the URL for direct return.</span>
            <span>Recent searches remain on this device.</span>
          </div>
        </section>

        {state.hasQuery ? (
          <section className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Everything Search summary">
            <article className="rounded-[1.4rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-4 text-[color:var(--loombus-cream-contrast)] shadow-sm dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">
                Matching results
              </span>
              <strong className="mt-2 block text-3xl tracking-[-0.04em]">{resultCount}</strong>
            </article>
            <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
                Current view
              </span>
              <strong className="mt-2 block truncate text-xl tracking-[-0.025em]">
                {GROUP_LABELS[state.activeGroup]}
              </strong>
            </article>
            <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
                Search mode
              </span>
              <strong className="mt-2 block text-xl tracking-[-0.025em]">
                {state.search.indexed ? "Unified index" : "Compatibility"}
              </strong>
            </article>
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0 space-y-5">
            {state.hasQuery ? (
              <>
                <EverythingSearchBrief search={state.search} loading={state.loading} />
                <EverythingSearchAi
                  working={state.aiWorking}
                  loading={state.loading || state.aiQueued}
                  answer={state.aiAnswer}
                  message={state.aiMessage}
                  upgradeRequired={state.aiUpgradeRequired}
                  sources={state.aiSources}
                  onAsk={state.askAi}
                />

                {state.groups.length > 1 ? (
                  <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Everything Search result groups">
                    {state.groups.map((group) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => state.selectGroup(group)}
                        aria-current={state.activeGroup === group ? "page" : undefined}
                        className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                          state.activeGroup === group
                            ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                            : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] hover:border-[color:var(--loombus-gold)]"
                        }`}
                      >
                        {GROUP_LABELS[group]}{" "}
                        <span className="ml-1 text-xs opacity-70">
                          {group === "all"
                            ? resultCount
                            : Number(state.search.counts[group] ?? 0)}
                        </span>
                      </button>
                    ))}
                  </nav>
                ) : null}

                {state.message ? (
                  <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500" role="alert">
                    {state.message}
                  </p>
                ) : null}

                <section>
                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                      Results
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                      {state.loading
                        ? "Searching permitted sources"
                        : `${state.visibleResults.length} ${GROUP_LABELS[state.activeGroup].toLowerCase()} result${state.visibleResults.length === 1 ? "" : "s"}`}
                    </h2>
                  </div>

                  {state.loading ? (
                    <div className="flex min-h-52 items-center justify-center rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
                      <div className="text-center text-[color:var(--loombus-text-muted)]">
                        <Loader2 className="mx-auto animate-spin text-[color:var(--loombus-gold)]" size={26} />
                        <p className="mt-3">Finding Loombus signal…</p>
                      </div>
                    </div>
                  ) : state.visibleResults.length ? (
                    <div className="grid gap-3">
                      {state.visibleResults.map((result) => (
                        <EverythingSearchResultCard key={result.id} result={result} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[1.75rem] border border-dashed border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center shadow-xl shadow-black/10">
                      <Compass className="mx-auto text-[color:var(--loombus-gold)]" size={42} />
                      <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">
                        No matching signal in this view.
                      </h2>
                      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                        Try a broader phrase, switch result groups, or start a focused discussion when the topic is not yet represented.
                      </p>
                      <Link
                        href={`/create?title=${encodeURIComponent(state.activeQuery)}`}
                        className="mt-5 inline-flex items-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-gold-contrast)]"
                      >
                        Start a discussion <ArrowRight size={16} />
                      </Link>
                    </div>
                  )}
                </section>
              </>
            ) : (
              <section>
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                    One index, many destinations
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                    Begin with what you need, not where it lives.
                  </h2>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    {
                      title: "Knowledge and discussion",
                      copy: "Find discussions, replies, Room knowledge, files, and platform resources you are permitted to access.",
                      icon: Layers3,
                    },
                    {
                      title: "People and communities",
                      copy: "Find contributors, profiles, Rooms, businesses, and accountable public sources.",
                      icon: UsersRound,
                    },
                    {
                      title: "Real-world action",
                      copy: "Move directly to Services, Requests, Jobs, Events, Marketplace listings, and Loombus tools.",
                      icon: BriefcaseBusiness,
                    },
                  ].map(({ title, copy, icon: Icon }) => (
                    <article
                      key={title}
                      className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10"
                    >
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                        <Icon size={20} />
                      </span>
                      <h3 className="mt-5 text-lg font-semibold tracking-[-0.025em]">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{copy}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            {state.history.length > 0 ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.3em]">Recent searches</p>
                  <Clock3 className="h-5 w-5 text-[color:var(--loombus-gold)]" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {state.history.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => state.runSearch(item)}
                      className="max-w-full truncate rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--loombus-text-muted)] transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-text)]"
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-[color:var(--loombus-text-subtle)]">
                  Stored locally on this device, not published to your profile.
                </p>
              </section>
            ) : null}

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-5 text-[color:var(--loombus-cream-contrast)] shadow-2xl shadow-black/10 dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/60 text-[color:var(--loombus-gold)] dark:bg-black/10">
                  <LockKeyhole className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold">Permission-aware search</h2>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    Public results are available without signing in. People, saved items, private notes, and permitted Room content appear only when the current account may access them.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Useful destinations</p>
              <div className="mt-4 space-y-2">
                {destinationLinks.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]"
                  >
                    {label}
                    <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold">How results are ordered</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Exact and prefix matches lead, broader content matches follow, and recency only breaks equal relevance. There is no sponsored placement.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <Bookmark className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Loombus AI uses only eligible returned sources. Private Room content and saved-item content remain outside AI context.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
