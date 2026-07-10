"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Lock,
  MessageCircle,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

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

const starterRoom = {
  id: "loombus-community",
  name: "Loombus Community Room",
  description:
    "A private starter room for Loombus updates, focused discussion, shared resources, and community coordination.",
  members: 1,
  category: "Community",
  isMine: true,
};

export default function RoomsPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<RoomFilter>("My Rooms");

  const visibleRooms = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const roomMatchesQuery =
      !cleanQuery ||
      `${starterRoom.name} ${starterRoom.description} ${starterRoom.category}`
        .toLowerCase()
        .includes(cleanQuery);
    const roomMatchesFilter =
      activeFilter === "All" ||
      (activeFilter === "My Rooms" && starterRoom.isMine) ||
      activeFilter === starterRoom.category;

    return roomMatchesQuery && roomMatchesFilter ? [starterRoom] : [];
  }, [activeFilter, query]);

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

        <section id="room-list" className="mt-7">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
              Available room
            </h2>
            <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 py-1 text-xs font-bold text-[var(--loombus-text-muted)]">
              {visibleRooms.length} {visibleRooms.length === 1 ? "room" : "rooms"}
            </span>
          </div>

          {visibleRooms.map((room) => (
            <article
              key={room.id}
              className="overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-xl shadow-black/5"
            >
              <div className="p-6 sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]">
                      <Users className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black tracking-tight">{room.name}</h3>
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--loombus-text-muted)]">
                          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                          Private
                        </span>
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--loombus-text-muted)]">
                        {room.description}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/rooms/${room.id}`}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-black text-[var(--loombus-primary-text)] transition hover:opacity-90"
                  >
                    Open Room
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>

                <div className="mt-6 grid gap-3 border-t border-[var(--loombus-border)] pt-5 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-2xl bg-[var(--loombus-surface-muted)] p-4">
                    <Users className="h-5 w-5 text-[var(--loombus-text-muted)]" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                        Members
                      </p>
                      <p className="mt-1 text-sm font-black">{room.members} member</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl bg-[var(--loombus-surface-muted)] p-4">
                    <MessageCircle className="h-5 w-5 text-[var(--loombus-text-muted)]" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                        Activity
                      </p>
                      <p className="mt-1 text-sm font-black">Ready for the first discussion</p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}

          {visibleRooms.length === 0 && (
            <div className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center shadow-xl shadow-black/5">
              <h3 className="text-lg font-black">No rooms found</h3>
              <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
                Try another search or room category.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
