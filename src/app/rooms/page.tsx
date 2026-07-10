"use client";

import { useState } from "react";
import { Search, Sparkles } from "lucide-react";

const filters = [
  "My Rooms",
  "All",
  "Business",
  "Residents",
  "Classroom",
  "Customer",
  "Community",
] as const;

type RoomFilter = (typeof filters)[number];

export default function RoomsPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<RoomFilter>("My Rooms");

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-amber-700 dark:text-amber-500 sm:text-sm">
              Private Room Dashboard
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Your rooms
            </h1>
            <p className="mt-4 text-sm font-bold text-[var(--loombus-text-muted)] sm:text-base">
              Private rooms loaded from rooms.
            </p>
          </div>

          <button
            type="button"
            aria-label="Create or subscribe to a room"
            className="inline-flex w-full items-center justify-center gap-3 rounded-[1.4rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-6 py-4 text-base font-black shadow-xl shadow-black/5 transition hover:bg-[var(--loombus-surface-muted)] lg:w-auto lg:min-w-[320px]"
          >
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            Create or subscribe to a room
          </button>
        </header>

        <section className="mt-8">
          <label className="flex min-h-20 items-center gap-4 rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-5 shadow-xl shadow-black/5 sm:px-7">
            <Search
              className="h-7 w-7 shrink-0 text-[var(--loombus-text-subtle)]"
              aria-hidden="true"
            />
            <span className="sr-only">Search your private rooms</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Search your private rooms"
              className="min-w-0 flex-1 bg-transparent text-lg font-medium text-[var(--loombus-text)] outline-none placeholder:text-[var(--loombus-text-subtle)] sm:text-xl"
            />
          </label>

          <div className="mt-5 flex gap-3 overflow-x-auto pb-3">
            {filters.map((filter) => {
              const selected = activeFilter === filter;

              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  aria-pressed={selected}
                  className={`shrink-0 rounded-full border px-5 py-3 text-sm font-black transition sm:px-7 sm:text-base ${
                    selected
                      ? "border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text)] shadow-lg shadow-black/5"
                      : "border-transparent bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)] hover:border-[var(--loombus-border)] hover:text-[var(--loombus-text)]"
                  }`}
                >
                  {filter}
                </button>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
