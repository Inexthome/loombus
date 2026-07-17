"use client";

import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Loader2,
  Search,
  Sparkles,
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

export default function SearchPage() {
  const state = useEverythingSearch();
  const aiBusy = state.aiQueued || state.aiWorking;

  return (
    <main className="search-v2-page loombus-shell-with-right-rail min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--loombus-text-subtle)]">
            Everything Search
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
            Search once. Find the right signal.
          </h1>
          <p className="mt-4 max-w-4xl leading-7 text-[var(--loombus-text-muted)]">
            Search discussions, replies, people, private Rooms, knowledge,
            services, events, media, documents, saved items, and Loombus
            destinations from one place.
          </p>

          <form
            onSubmit={state.submit}
            className="mt-7 flex flex-col gap-3 rounded-[1.4rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-3 lg:flex-row lg:items-center"
          >
            <Search
              className="ml-2 hidden text-[var(--loombus-text-subtle)] lg:block"
              size={21}
            />
            <input
              type="search"
              aria-label="Search everything in Loombus"
              value={state.query}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                state.setQuery(event.target.value)
              }
              placeholder="Search a question, person, Room, service, event, or document"
              className="min-w-0 flex-1 bg-transparent px-3 py-3 outline-none placeholder:text-[var(--loombus-text-subtle)]"
            />
            {state.query ? (
              <button
                type="button"
                aria-label="Clear search field"
                onClick={() => state.setQuery("")}
                className="hidden rounded-full p-2 lg:block"
              >
                <X size={17} />
              </button>
            ) : null}
            <button
              type="submit"
              disabled={state.query.trim().length < 2 || aiBusy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--loombus-primary-bg)] px-6 py-3 font-semibold text-[var(--loombus-primary-text)] disabled:opacity-45"
            >
              Search <ArrowRight size={17} />
            </button>
            <button
              type="button"
              onClick={state.askAiFromInput}
              disabled={state.query.trim().length < 2 || aiBusy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-6 py-3 font-semibold disabled:opacity-45"
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
        </section>

        {!state.hasQuery && state.history.length > 0 ? (
          <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Clock3 size={16} /> Recent searches
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {state.history.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => state.runSearch(item)}
                  className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm text-[var(--loombus-text-muted)]"
                >
                  {item}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {state.hasQuery ? (
          <>
            <EverythingSearchBrief
              search={state.search}
              loading={state.loading}
            />
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
              <nav className="mt-5 flex gap-2 overflow-x-auto pb-2">
                {state.groups.map((group) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => state.selectGroup(group)}
                    className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold ${
                      state.activeGroup === group
                        ? "border-[var(--loombus-text)] bg-[var(--loombus-text)] text-[var(--loombus-page-bg)]"
                        : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)]"
                    }`}
                  >
                    {GROUP_LABELS[group]}{" "}
                    {group === "all"
                      ? state.search.results.length
                      : Number(state.search.counts[group] ?? 0)}
                  </button>
                ))}
              </nav>
            ) : null}

            {state.message ? (
              <p className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
                {state.message}
              </p>
            ) : null}

            <section className="mt-4">
              {state.loading ? (
                <div className="flex min-h-52 items-center justify-center rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]">
                  <Loader2 className="animate-spin" size={24} />
                </div>
              ) : state.visibleResults.length ? (
                <div className="grid gap-3">
                  {state.visibleResults.map((result) => (
                    <EverythingSearchResultCard
                      key={result.id}
                      result={result}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
                  <h2 className="text-xl font-semibold">
                    No matching signal yet.
                  </h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                    Start the discussion now. Services, products, jobs,
                    companies, and marketplace listings can use this same index
                    as those directories open.
                  </p>
                  <Link
                    href={`/create?title=${encodeURIComponent(
                      state.activeQuery
                    )}`}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold"
                  >
                    Start a discussion <ArrowRight size={16} />
                  </Link>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              [
                "Human knowledge",
                "Discussions, replies, summaries, and Room knowledge.",
              ],
              [
                "People and communities",
                "Contributors, expertise, and private Rooms.",
              ],
              [
                "Real-world action",
                "Services, events, media, files, and future listings.",
              ],
            ].map(([title, copy]) => (
              <article
                key={title}
                className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6"
              >
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                  {copy}
                </p>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
