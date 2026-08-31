"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SignalDirectoryCard from "./signal-directory-card";
import SignalDirectoryDetail from "./signal-directory-detail";
import {
  buildDirectoryItems,
  getDimensionLabel,
  getDimensionValue,
  isDirectoryDimension,
  type DirectoryDimension,
} from "./signal-directory-model";
import { useSignalDirectoryData } from "./use-signal-directory-data";

const DIRECTORY_TABS = [
  {
    value: "topic",
    label: "Topics",
    description: "What the discussion is about",
  },
  {
    value: "reality",
    label: "Reality Lenses",
    description: "What lived reality it examines",
  },
  {
    value: "purpose",
    label: "Purpose Lanes",
    description: "What the discussion aims to advance",
  },
] as const;

export default function SignalDirectoryClient() {
  const [dimension, setDimension] = useState<DirectoryDimension>("topic");
  const [selectedValue, setSelectedValue] = useState("");
  const [query, setQuery] = useState("");
  const data = useSignalDirectoryData();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedDimension = params.get("dimension");
    const requestedValue = params.get("value")?.trim() || "";

    if (isDirectoryDimension(requestedDimension)) {
      setDimension(requestedDimension);
    }
    setSelectedValue(requestedValue);
  }, []);

  const items = useMemo(
    () =>
      buildDirectoryItems({
        dimension,
        discussions: data.discussions,
        replyCounts: data.replyCounts,
        viewCounts: data.viewCounts,
        saveCounts: data.saveCounts,
      }),
    [data.discussions, data.replyCounts, data.saveCounts, data.viewCounts, dimension]
  );

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;

    return items.filter((item) =>
      [item.value, item.description, item.latestDiscussion?.title]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [items, query]);

  const selectedItem = useMemo(
    () => items.find((item) => item.value === selectedValue) ?? null,
    [items, selectedValue]
  );

  const selectedDiscussions = useMemo(() => {
    if (!selectedItem) return [];

    return data.discussions.filter(
      (discussion) => getDimensionValue(discussion, dimension) === selectedItem.value
    );
  }, [data.discussions, dimension, selectedItem]);

  const activeCount = items.filter((item) => item.active).length;
  const usedCount = items.filter((item) => item.discussionCount > 0).length;
  const totalActivity = items.reduce((total, item) => total + item.activityScore, 0);

  function replaceDirectoryUrl(nextDimension: DirectoryDimension, value = "") {
    const params = new URLSearchParams();
    params.set("dimension", nextDimension);
    if (value) params.set("value", value);
    window.history.replaceState(null, "", `/topics?${params.toString()}`);
  }

  function changeDimension(nextDimension: DirectoryDimension) {
    setDimension(nextDimension);
    setSelectedValue("");
    setQuery("");
    data.setMessage("");
    replaceDirectoryUrl(nextDimension);
  }

  function openValue(value: string) {
    setSelectedValue(value);
    replaceDirectoryUrl(dimension, value);
  }

  function closeValue() {
    setSelectedValue("");
    replaceDirectoryUrl(dimension);
  }

  return (
    <main
      data-loombus-topics-editorial
      className="min-h-screen bg-[color:var(--topics-editorial-page-bg,var(--loombus-page-bg))] px-4 pb-24 pt-6 text-[color:var(--loombus-text)] sm:px-6 sm:pt-10 lg:px-8"
    >
      <div className="mx-auto w-full max-w-5xl">
        <header className="border-b border-[color:var(--loombus-border)] pb-8 sm:pb-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">
                Signal Directory
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Explore the ideas shaping Loombus
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--loombus-text-muted)] sm:text-base">
                Browse topics, Reality Lenses, and Purpose Lanes to see where discussion is active, what people are examining, and what those conversations aim to advance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
              <Link
                href="/discussions"
                className="min-h-11 content-center font-medium text-[color:var(--loombus-text-muted)] underline decoration-[color:var(--loombus-border)] underline-offset-4 transition hover:text-[color:var(--loombus-text)] motion-reduce:transition-none"
              >
                Browse discussions
              </Link>
              <Link
                href="/create"
                className="inline-flex min-h-11 items-center border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-4 py-2.5 text-sm font-semibold text-[#17140B] transition hover:opacity-90 motion-reduce:transition-none"
              >
                Create discussion
              </Link>
            </div>
          </div>
        </header>

        <section aria-label="Directory summary" className="border-b border-[color:var(--loombus-border)] py-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-[color:var(--loombus-text-muted)]">{getDimensionLabel(dimension)}</dt>
              <dd className="mt-1 text-lg font-semibold">{items.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-[color:var(--loombus-text-muted)]">Used by discussions</dt>
              <dd className="mt-1 text-lg font-semibold">{usedCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-[color:var(--loombus-text-muted)]">Active in 30 days</dt>
              <dd className="mt-1 text-lg font-semibold">{activeCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-[color:var(--loombus-text-muted)]">Total activity</dt>
              <dd className="mt-1 text-lg font-semibold text-[color:var(--loombus-gold)]">{totalActivity.toLocaleString()}</dd>
            </div>
          </dl>
        </section>

        <nav aria-label="Signal directory dimensions" className="border-b border-[color:var(--loombus-border)]">
          <div className="flex min-w-0 gap-6 overflow-x-auto">
            {DIRECTORY_TABS.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => changeDimension(value)}
                aria-pressed={dimension === value}
                className={`min-h-16 shrink-0 border-b-2 px-0 py-3 text-left transition motion-reduce:transition-none ${
                  dimension === value
                    ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-text)]"
                    : "border-transparent text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"
                }`}
              >
                <span className="block text-sm font-semibold">{label}</span>
                <span className="mt-1 block text-xs">{description}</span>
              </button>
            ))}
          </div>
        </nav>

        <section className="border-b border-[color:var(--loombus-border)] py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="block min-w-0 flex-1">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">
                Search {getDimensionLabel(dimension)}
              </span>
              <span className="mt-2 flex min-h-11 items-center gap-3 border-b border-[color:var(--loombus-border)] focus-within:border-[color:var(--loombus-gold)]">
                <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--loombus-text-muted)]" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Search ${getDimensionLabel(dimension).toLowerCase()}`}
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-[color:var(--loombus-text-muted)]"
                />
                {query ? (
                  <button type="button" onClick={() => setQuery("")} className="min-h-11 min-w-11" aria-label="Clear search">
                    <X aria-hidden="true" className="mx-auto h-4 w-4" />
                  </button>
                ) : null}
              </span>
            </label>
            <p className="text-sm text-[color:var(--loombus-text-muted)]">
              {filteredItems.length} {getDimensionLabel(dimension).toLowerCase()}
            </p>
          </div>
        </section>

        {data.message ? (
          <div role="status" className="border-b border-[color:var(--loombus-border)] py-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{data.message}</span>
              {!data.canFollowTopics && data.viewerId ? (
                <Link href="/premium" className="font-semibold text-[color:var(--loombus-gold)]">View Premium</Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {selectedItem ? (
          <SignalDirectoryDetail
            dimension={dimension}
            item={selectedItem}
            discussions={selectedDiscussions}
            profiles={data.profiles}
            replyCounts={data.replyCounts}
            viewCounts={data.viewCounts}
            saveCounts={data.saveCounts}
            onClose={closeValue}
          />
        ) : null}

        {data.loading ? (
          <section aria-live="polite" className="border-b border-[color:var(--loombus-border)] py-12">
            <h2 className="text-lg font-semibold">Reading directory activity…</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              Counting discussions, replies, views, saves, and recent activity.
            </p>
          </section>
        ) : filteredItems.length === 0 ? (
          <section className="border-b border-[color:var(--loombus-border)] py-12">
            <h2 className="text-lg font-semibold">No matching directory entries.</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              Broaden the search or clear it to restore the full directory.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-4 min-h-11 border-b border-[color:var(--loombus-gold)] text-sm font-semibold"
            >
              Clear search
            </button>
          </section>
        ) : (
          <section aria-label={`${getDimensionLabel(dimension)} directory`} className="divide-y divide-[color:var(--loombus-border)]">
            {filteredItems.map((item) => (
              <SignalDirectoryCard
                key={item.value}
                dimension={dimension}
                item={item}
                isFollowing={dimension === "topic" && data.followedSet.has(item.value)}
                saving={data.savingTopic === item.value}
                onFollow={(topic) => void data.toggleTopicFollow(topic)}
                onOpen={openValue}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
