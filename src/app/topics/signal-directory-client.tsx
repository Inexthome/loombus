"use client";

import {
  Compass,
  Layers3,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
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
    Icon: Compass,
  },
  {
    value: "reality",
    label: "Reality Lenses",
    description: "What lived reality it examines",
    Icon: Layers3,
  },
  {
    value: "purpose",
    label: "Purpose Lanes",
    description: "What the discussion aims to advance",
    Icon: Target,
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
    [
      data.discussions,
      data.replyCounts,
      data.saveCounts,
      data.viewCounts,
      dimension,
    ]
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
      (discussion) =>
        getDimensionValue(discussion, dimension) === selectedItem.value
    );
  }, [data.discussions, dimension, selectedItem]);

  const activeCount = items.filter((item) => item.active).length;
  const usedCount = items.filter((item) => item.discussionCount > 0).length;
  const totalActivity = items.reduce(
    (total, item) => total + item.activityScore,
    0
  );

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
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-sm">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#A9822F]">
                Signal Directory
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Topics, Reality Lenses, and Purpose Lanes
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)] sm:text-base">
                Explore what a discussion is about, the lived reality it examines,
                and the outcome it is intended to advance. These three dimensions
                form the complete Loombus framing system.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/discussions"
                className="rounded-full border border-[color:var(--loombus-border)] px-4 py-2.5 text-sm font-bold transition hover:bg-[color:var(--loombus-surface-muted)]"
              >
                Browse discussions
              </Link>
              <Link
                href="/create"
                className="rounded-full bg-[#CBAB5B] px-4 py-2.5 text-sm font-black text-black transition hover:brightness-105"
              >
                Create discussion
              </Link>
            </div>
          </div>

          <div className="grid border-t border-[color:var(--loombus-border-muted)] sm:grid-cols-4">
            <article className="border-b border-[color:var(--loombus-border-muted)] p-4 sm:border-b-0 sm:border-r">
              <span className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                {getDimensionLabel(dimension)}
              </span>
              <strong className="mt-1 block text-2xl">{items.length}</strong>
            </article>
            <article className="border-b border-[color:var(--loombus-border-muted)] p-4 sm:border-b-0 sm:border-r">
              <span className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                Used by discussions
              </span>
              <strong className="mt-1 block text-2xl">{usedCount}</strong>
            </article>
            <article className="border-b border-[color:var(--loombus-border-muted)] p-4 sm:border-b-0 sm:border-r">
              <span className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                Active in 30 days
              </span>
              <strong className="mt-1 block text-2xl">{activeCount}</strong>
            </article>
            <article className="bg-[#CBAB5B]/10 p-4">
              <span className="text-xs font-semibold text-[#8B6B24]">
                Total activity
              </span>
              <strong className="mt-1 block text-2xl text-[#8B6B24]">
                {totalActivity.toLocaleString()}
              </strong>
            </article>
          </div>
        </header>

        <section className="rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-3 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-3">
            {DIRECTORY_TABS.map(({ value, label, description, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => changeDimension(value)}
                className={`rounded-2xl border p-4 text-left transition ${
                  dimension === value
                    ? "border-[#CBAB5B] bg-[#CBAB5B]/10"
                    : "border-transparent hover:border-[color:var(--loombus-border)] hover:bg-[color:var(--loombus-surface-muted)]"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-black">
                  <Icon aria-hidden="true" className="h-4 w-4 text-[#A9822F]" />
                  {label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[color:var(--loombus-text-muted)]">
                  {description}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-3 rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center">
          <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3">
            <Search
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-[color:var(--loombus-text-muted)]"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${getDimensionLabel(dimension).toLowerCase()}`}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--loombus-text-muted)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </label>
          <span className="text-sm font-semibold text-[color:var(--loombus-text-muted)]">
            {filteredItems.length} {getDimensionLabel(dimension).toLowerCase()}
          </span>
        </section>

        {data.message ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#CBAB5B]/50 bg-[#CBAB5B]/10 px-4 py-3 text-sm font-semibold">
            <span>{data.message}</span>
            {!data.canFollowTopics && data.viewerId ? (
              <Link href="/premium" className="font-black text-[#8B6B24]">
                View Premium
              </Link>
            ) : null}
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
          <section className="rounded-[2rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-12 text-center shadow-sm">
            <Sparkles
              aria-hidden="true"
              className="mx-auto h-7 w-7 text-[#A9822F]"
            />
            <h2 className="mt-4 text-xl font-black">
              Reading directory activity…
            </h2>
            <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
              Counting discussions, replies, views, saves, and recent activity.
            </p>
          </section>
        ) : filteredItems.length === 0 ? (
          <section className="rounded-[2rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-12 text-center shadow-sm">
            <Search
              aria-hidden="true"
              className="mx-auto h-7 w-7 text-[#A9822F]"
            />
            <h2 className="mt-4 text-xl font-black">
              No matching directory entries.
            </h2>
            <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
              Broaden the search or clear it to restore the full directory.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-4 rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-black"
            >
              Clear search
            </button>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <SignalDirectoryCard
                key={item.value}
                dimension={dimension}
                item={item}
                isFollowing={
                  dimension === "topic" && data.followedSet.has(item.value)
                }
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
