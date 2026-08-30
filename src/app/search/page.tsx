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
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[86rem]">
        <header className="grid gap-5 border-b border-[color:var(--loombus-border)] pb-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
              Everything Search
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
              Search once. Find the right signal.
            </h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Search the Loombus index across discussions, replies, people, permitted Room content, Services, Requests, Jobs, Events, Marketplace, saved items, files, and platform destinations.
            </p>
          </div>
          <p className="border-l-2 border-[color:var(--loombus-gold)] pl-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Permission-aware by design. Search reveals only what the current visitor or account may access.
          </p>
        </header>

        <section className="border-b border-[color:var(--loombus-border)] py-6">
          <form
            onSubmit={state.submit}
            className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end"
          >
            <label className="relative block min-w-0">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-subtle)]">
                Search Loombus
              </span>
              <Search className="pointer-events-none absolute bottom-4 left-1 h-5 w-5 text-[color:var(--loombus-gold)]" />
              <input
                type="search"
                value={state.query}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  state.setQuery(event.target.value)
                }
                placeholder="Search a question, person, Service, Request, Job, Event, or page"
                className="h-14 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent pl-9 pr-12 text-base text-[color:var(--loombus-text)] outline-none transition-colors placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus-visible:ring-0"
              />
              {state.query ? (
                <button
                  type="button"
                  aria-label="Clear search field"
                  onClick={() => state.setQuery("")}
                  className="absolute bottom-2.5 right-0 grid h-11 w-11 place-items-center text-[color:var(--loombus-text-muted)] transition-colors hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)]"
                >
                  <X size={17} />
                </button>
              ) : null}
            </label>
            <button
              type="submit"
              disabled={state.query.trim().length < 2 || aiBusy}
              className="inline-flex min-h-12 items-center justify-center gap-2 border-b-2 border-[color:var(--loombus-gold)] px-2 py-3 text-sm font-semibold transition-colors hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] disabled:opacity-45"
            >
              Search <ArrowRight size={17} />
            </button>
            <button
              type="button"
              onClick={state.askAiFromInput}
              disabled={state.query.trim().length < 2 || aiBusy}
              className="inline-flex min-h-12 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] px-2 py-3 text-sm font-semibold transition-colors hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] disabled:opacity-45"
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--loombus-text-subtle)]">
            <span>Enter at least two characters. Search terms stay in the URL for direct return.</span>
            <span>Recent searches remain on this device.</span>
          </div>
        </section>

        {state.hasQuery ? (
          <section className="grid border-b border-[color:var(--loombus-border)] sm:grid-cols-3" aria-label="Everything Search summary">
            <article className="border-b border-[color:var(--loombus-border)] py-5 sm:border-b-0 sm:border-r sm:pr-6">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">
                Matching results
              </span>
              <strong className="mt-2 block text-3xl tracking-[-0.04em]">{resultCount}</strong>
            </article>
            <article className="border-b border-[color:var(--loombus-border)] py-5 sm:border-b-0 sm:border-r sm:px-6">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
                Current view
              </span>
              <strong className="mt-2 block truncate text-xl tracking-[-0.025em]">
                {GROUP_LABELS[state.activeGroup]}
              </strong>
            </article>
            <article className="py-5 sm:pl-6">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
                Search mode
              </span>
              <strong className="mt-2 block text-xl tracking-[-0.025em]">
                {state.search.indexed ? "Unified index" : "Compatibility"}
              </strong>
            </article>
          </section>
        ) : null}

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0">
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
                  <nav className="flex gap-5 overflow-x-auto border-b border-[color:var(--loombus-border)] py-4" aria-label="Everything Search result groups">
                    {state.groups.map((group) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => state.selectGroup(group)}
                        aria-current={state.activeGroup === group ? "page" : undefined}
                        className={`shrink-0 min-h-11 border-b-2 px-1 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] ${
                          state.activeGroup === group
                            ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-text)]"
                            : "border-transparent text-[color:var(--loombus-text-muted)] hover:border-[color:var(--loombus-border)] hover:text-[color:var(--loombus-text)]"
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
                  <p className="border-l-2 border-red-500 py-3 pl-4 text-sm text-red-500" role="alert">
                    {state.message}
                  </p>
                ) : null}

                <section className="py-6">
                  <div className="mb-2">
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
                    <div className="flex min-h-52 items-center justify-center border-y border-[color:var(--loombus-border)]">
                      <div className="text-center text-[color:var(--loombus-text-muted)]">
                        <Loader2 className="mx-auto animate-spin text-[color:var(--loombus-gold)]" size={26} />
                        <p className="mt-3">Finding Loombus signal…</p>
                      </div>
                    </div>
                  ) : state.visibleResults.length ? (
                    <div>
                      {state.visibleResults.map((result) => (
                        <EverythingSearchResultCard key={result.id} result={result} />
                      ))}
                    </div>
                  ) : (
                    <div className="border-y border-dashed border-[color:var(--loombus-border)] py-12 text-center">
                      <Compass className="mx-auto text-[color:var(--loombus-gold)]" size={42} />
                      <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">
                        No matching signal in this view.
                      </h2>
                      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                        Try a broader phrase, switch result groups, or start a focused discussion when the topic is not yet represented.
                      </p>
                      <Link
                        href={`/create?title=${encodeURIComponent(state.activeQuery)}`}
                        className="mt-5 inline-flex min-h-11 items-center gap-2 border-b-2 border-[color:var(--loombus-gold)] px-1 py-2 text-sm font-semibold transition-colors hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)]"
                      >
                        Start a discussion <ArrowRight size={16} />
                      </Link>
                    </div>
                  )}
                </section>
              </>
            ) : (
              <section className="py-7">
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                    One index, many destinations
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                    Begin with what you need, not where it lives.
                  </h2>
                </div>
                <div className="grid border-t border-[color:var(--loombus-border)] md:grid-cols-3">
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
                  ].map(({ title, copy, icon: Icon }, index) => (
                    <article
                      key={title}
                      className={`border-b border-[color:var(--loombus-border)] py-6 md:px-6 ${index === 0 ? "md:pl-0" : "md:border-l"}`}
                    >
                      <Icon className="text-[color:var(--loombus-gold)]" size={20} aria-hidden="true" />
                      <h3 className="mt-4 text-lg font-semibold tracking-[-0.025em]">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{copy}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </section>

          <aside className="border-t border-[color:var(--loombus-border)] xl:border-l xl:border-t-0 xl:pl-6">
            {state.history.length > 0 ? (
              <section className="border-b border-[color:var(--loombus-border)] py-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.3em]">Recent searches</p>
                  <Clock3 className="h-5 w-5 text-[color:var(--loombus-gold)]" aria-hidden="true" />
                </div>
                <div className="mt-3 divide-y divide-[color:var(--loombus-border)]">
                  {state.history.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => state.runSearch(item)}
                      className="block min-h-11 w-full truncate py-2 text-left text-xs font-semibold text-[color:var(--loombus-text-muted)] transition-colors hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)]"
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

            <section className="border-b border-[color:var(--loombus-border)] py-6">
              <LockKeyhole className="h-5 w-5 text-[color:var(--loombus-gold)]" aria-hidden="true" />
              <h2 className="mt-3 font-semibold">Permission-aware search</h2>
              <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                Public results are available without signing in. People, saved items, private notes, and permitted Room content appear only when the current account may access them.
              </p>
            </section>

            <section className="border-b border-[color:var(--loombus-border)] py-6">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Useful destinations</p>
              <div className="mt-3 divide-y divide-[color:var(--loombus-border)]">
                {destinationLinks.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex min-h-11 items-center justify-between py-2 text-sm font-semibold transition-colors hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)]"
                  >
                    {label}
                    <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                  </Link>
                ))}
              </div>
            </section>

            <section className="border-b border-[color:var(--loombus-border)] py-6">
              <ShieldCheck className="h-5 w-5 text-[color:var(--loombus-gold)]" aria-hidden="true" />
              <h3 className="mt-3 font-semibold">How results are ordered</h3>
              <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                Exact and prefix matches lead, broader content matches follow, and recency only breaks equal relevance. There is no sponsored placement.
              </p>
            </section>

            <section className="py-6">
              <div className="flex gap-3">
                <Bookmark className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" aria-hidden="true" />
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
