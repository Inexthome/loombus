"use client";

import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";
import {
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  MessageCircle,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import PeopleFollowRequestsPanel from "./people-follow-requests-panel";

type Member = {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isAdmin: boolean;
  privateAccount: boolean;
  following: boolean;
  followsYou: boolean;
  mutual: boolean;
  requested: boolean;
  followerCount: number;
  followingCount: number;
};

type DirectoryPayload = {
  members?: Member[];
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
  adminVisibility?: boolean;
  error?: string;
};

type View = "all" | "following" | "followers" | "mutual" | "requests";
type Sort = "recommended" | "name" | "followers";
type Quality = "all" | "bio" | "complete";
type Role = "all" | "member" | "admin";

const VIEWS: Array<[View, string]> = [
  ["all", "All members"],
  ["following", "Following"],
  ["followers", "Followers"],
  ["mutual", "Mutual"],
  ["requests", "Requests"],
];

const VIEW_KEYS = new Set<View>(VIEWS.map(([key]) => key));

function displayName(member: Member) {
  return member.fullName?.trim() || member.username?.trim() || "Loombus member";
}

function completeProfile(member: Member) {
  return Boolean(
    member.fullName?.trim() &&
      member.username?.trim() &&
      member.avatarUrl &&
      member.bio?.trim()
  );
}

async function getSessionToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function PeopleV2Client() {
  const [members, setMembers] = useState<Member[]>([]);
  const [viewerReady, setViewerReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [openingMessage, setOpeningMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [view, setView] = useState<View>("all");
  const [sort, setSort] = useState<Sort>("recommended");
  const [role, setRole] = useState<Role>("all");
  const [quality, setQuality] = useState<Quality>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [adminVisibility, setAdminVisibility] = useState(false);

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view") as View | null;
    if (requestedView && VIEW_KEYS.has(requestedView)) setView(requestedView);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (view === "all") {
      url.searchParams.delete("view");
      url.searchParams.delete("request");
    } else {
      url.searchParams.set("view", view);
      if (view !== "requests") url.searchParams.delete("request");
    }
    window.history.replaceState({}, "", url);
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    async function resolveViewer() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSignedIn(Boolean(data.session));
      setViewerReady(true);
    }
    void resolveViewer();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!viewerReady || !signedIn) {
      if (viewerReady) setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadDirectory() {
      setLoading(true);
      setNotice("");
      const token = await getSessionToken();
      if (!token) {
        setSignedIn(false);
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({
        page: String(page),
        pageSize: "48",
      });
      if (activeQuery.trim().length >= 2) params.set("q", activeQuery.trim());

      const response = await fetch(`/api/people/directory?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as DirectoryPayload;
      if (cancelled) return;

      if (!response.ok) {
        setNotice(payload.error ?? "People could not load. Refresh and try again.");
        setMembers([]);
      } else {
        setMembers(payload.members ?? []);
        setTotal(payload.total ?? 0);
        setHasMore(Boolean(payload.hasMore));
        setAdminVisibility(Boolean(payload.adminVisibility));
      }
      setLoading(false);
    }

    void loadDirectory();
    return () => {
      cancelled = true;
    };
  }, [activeQuery, page, signedIn, viewerReady]);

  const filteredMembers = useMemo(() => {
    const rows = members.filter((member) => {
      const relationshipMatches =
        view === "all" ||
        (view === "following" && member.following) ||
        (view === "followers" && member.followsYou) ||
        (view === "mutual" && member.mutual) ||
        (view === "requests" && member.requested);
      const roleMatches =
        role === "all" ||
        (role === "admin" && member.isAdmin) ||
        (role === "member" && !member.isAdmin);
      const qualityMatches =
        quality === "all" ||
        (quality === "bio" && Boolean(member.bio?.trim())) ||
        (quality === "complete" && completeProfile(member));
      return relationshipMatches && roleMatches && qualityMatches;
    });

    return rows.sort((left, right) => {
      if (sort === "name") return displayName(left).localeCompare(displayName(right));
      if (sort === "followers") return right.followerCount - left.followerCount;
      const leftRank =
        Number(left.mutual) * 8 +
        Number(left.followsYou) * 4 +
        Number(left.following) * 3 +
        Number(left.requested) * 2 +
        Math.min(left.followerCount, 20) / 20;
      const rightRank =
        Number(right.mutual) * 8 +
        Number(right.followsYou) * 4 +
        Number(right.following) * 3 +
        Number(right.requested) * 2 +
        Math.min(right.followerCount, 20) / 20;
      return rightRank - leftRank || displayName(left).localeCompare(displayName(right));
    });
  }, [members, quality, role, sort, view]);

  const metrics = useMemo(
    () => ({
      visible: members.length,
      following: members.filter((member) => member.following).length,
      followers: members.filter((member) => member.followsYou).length,
      mutual: members.filter((member) => member.mutual).length,
      requested: members.filter((member) => member.requested).length,
    }),
    [members]
  );

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setActiveQuery(query.trim());
  }

  function selectView(nextView: View) {
    setView(nextView);
    if (nextView !== "requests") setPage(1);
  }

  async function toggleFollow(member: Member) {
    if (working) return;
    setWorking(member.id);
    setNotice("");
    const token = await getSessionToken();
    if (!token) {
      window.location.href = "/login?next=/people";
      return;
    }

    const response = await fetch("/api/follows/toggle", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetUserId: member.id }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setNotice(payload.error ?? "Unable to update follow status.");
    } else {
      setMembers((current) =>
        current.map((item) => {
          if (item.id !== member.id) return item;
          const following = Boolean(payload.following);
          const requested = Boolean(payload.requested);
          return {
            ...item,
            following,
            requested,
            mutual: following && item.followsYou,
            followerCount: Math.max(
              0,
              item.followerCount +
                (following && !item.following ? 1 : !following && item.following ? -1 : 0)
            ),
          };
        })
      );
      setNotice(
        payload.requested
          ? `Follow request sent to ${displayName(member)}.`
          : payload.following
            ? `Following ${displayName(member)}.`
            : member.requested
              ? `Follow request cancelled for ${displayName(member)}.`
              : `Unfollowed ${displayName(member)}.`
      );
    }
    setWorking("");
  }

  async function openMessage(member: Member) {
    if (openingMessage) return;
    setOpeningMessage(member.id);
    setNotice("");
    const token = await getSessionToken();
    if (!token) {
      window.location.href = "/login?next=/people";
      return;
    }

    const response = await fetch("/api/messages/conversations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetUserId: member.id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      window.location.href = `/messages?conversation=${encodeURIComponent(payload.conversationId)}`;
      return;
    }
    setNotice(payload.error ?? "Unable to start a private conversation.");
    setOpeningMessage("");
  }

  if (!viewerReady || loading) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] p-6 text-[var(--loombus-text)]">
        <section className="mx-auto max-w-7xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8">
          <p className="text-sm font-semibold uppercase tracking-[.22em] text-[var(--loombus-gold)]">People discovery</p>
          <h1 className="mt-3 text-4xl font-bold">Loading the Loombus member directory…</h1>
        </section>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] p-6 text-[var(--loombus-text)]">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8">
          <p className="text-sm font-semibold uppercase tracking-[.22em] text-[var(--loombus-gold)]">Members only</p>
          <h1 className="mt-3 text-4xl font-bold">Log in to browse Loombus members.</h1>
          <p className="mt-4 text-[var(--loombus-text-muted)]">The directory is visible inside Loombus while undiscoverable accounts and blocked relationships remain hidden.</p>
          <Link href="/login?next=/people" className="mt-6 inline-flex rounded-full bg-[var(--loombus-gold-strong)] px-6 py-3 font-semibold text-[var(--loombus-gold-contrast)]">Log in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-4 text-[var(--loombus-text)] sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[.22em] text-[var(--loombus-gold)]">Loombus member directory</p>
          <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="max-w-4xl text-4xl font-bold tracking-[-.045em] sm:text-6xl">Discover every member who chooses to be found.</h1>
              <p className="mt-4 max-w-3xl leading-7 text-[var(--loombus-text-muted)]">Browse the active Loombus community, search by identity or experience, and build relationships around useful signal. Private accounts require approval before following.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/following" className="rounded-full bg-[var(--loombus-gold-strong)] px-5 py-3 text-sm font-semibold text-[var(--loombus-gold-contrast)]">Following feed</Link>
              <Link href="/settings?section=privacy-safety" className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold">Privacy settings</Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ["Directory page", metrics.visible],
            ["Following", metrics.following],
            ["Followers", metrics.followers],
            ["Mutual", metrics.mutual],
            ["Sent on page", metrics.requested],
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
              <p className="text-xs uppercase tracking-[.16em] text-[var(--loombus-text-subtle)]">{label}</p>
              <p className="mt-2 text-2xl font-bold">{value}</p>
            </article>
          ))}
        </section>

        {notice ? <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm text-[var(--loombus-text-muted)]" role="status">{notice}</div> : null}

        <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 sm:p-5">
          {view !== "requests" ? (
            <form onSubmit={submitSearch} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_12rem_12rem_12rem]">
              <label className="relative">
                <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--loombus-text-subtle)]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names, usernames, or bios" className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] py-3.5 pl-12 pr-4 text-sm outline-none focus:border-[var(--loombus-gold)]" />
              </label>
              <button type="submit" className="rounded-2xl bg-[var(--loombus-gold-strong)] px-5 py-3 text-sm font-semibold text-[var(--loombus-gold-contrast)]">Search</button>
              <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 text-sm"><option value="recommended">Recommended</option><option value="name">Name A–Z</option><option value="followers">Most followed</option></select>
              <select value={role} onChange={(event) => setRole(event.target.value as Role)} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 text-sm"><option value="all">All roles</option><option value="member">Members</option><option value="admin">Admins</option></select>
              <select value={quality} onChange={(event) => setQuality(event.target.value as Quality)} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 text-sm"><option value="all">All profiles</option><option value="bio">With bio</option><option value="complete">Complete profiles</option></select>
            </form>
          ) : (
            <p className="text-sm text-[var(--loombus-text-muted)]">Review incoming requests or manage requests you sent to private accounts.</p>
          )}
          <div className={`${view !== "requests" ? "mt-4 border-t" : "mt-3"} flex gap-2 overflow-x-auto border-[var(--loombus-border)] pt-4`}>
            {VIEWS.map(([key, label]) => (
              <button key={key} type="button" onClick={() => selectView(key)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${view === key ? "border-[var(--loombus-gold-strong)] bg-[var(--loombus-gold-strong)] text-[var(--loombus-gold-contrast)]" : "border-[var(--loombus-border)] text-[var(--loombus-text-muted)]"}`}>{label}</button>
            ))}
          </div>
        </section>

        {view === "requests" ? (
          <PeopleFollowRequestsPanel />
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">{filteredMembers.length} shown · {total} discoverable members</p>
                <p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">{adminVisibility ? "Admin visibility includes active undiscoverable accounts." : "Undiscoverable accounts and blocked relationships are excluded."}</p>
              </div>
              {activeQuery ? <button type="button" onClick={() => { setQuery(""); setActiveQuery(""); setPage(1); }} className="text-sm font-semibold text-[var(--loombus-text-muted)]">Clear search</button> : null}
            </div>

            {filteredMembers.length ? (
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredMembers.map((member) => {
                  const profile = { id: member.id, full_name: member.fullName, username: member.username, avatar_url: member.avatarUrl };
                  const href = member.username ? `/u/${encodeURIComponent(member.username)}` : "/people";
                  return (
                    <article key={member.id} className="rounded-[1.65rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm">
                      <div className="flex items-start gap-4">
                        <Link href={href}><ProfileAvatar profile={profile} size="lg" /></Link>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={href} className="truncate text-lg font-bold">{displayName(member)}</Link>
                            {member.isAdmin ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[.68rem] font-bold text-amber-900"><ShieldCheck className="size-3" /> Admin</span> : null}
                            {member.privateAccount ? <span className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-2 py-1 text-[.68rem] font-bold text-[var(--loombus-text-muted)]"><LockKeyhole className="size-3" /> Private</span> : null}
                            {member.mutual ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-[.68rem] font-bold text-emerald-800">Mutual</span> : member.followsYou ? <span className="rounded-full bg-sky-100 px-2 py-1 text-[.68rem] font-bold text-sky-800">Follows you</span> : null}
                          </div>
                          <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{member.username ? `@${member.username}` : "Loombus member"}</p>
                        </div>
                      </div>

                      <p className="mt-4 line-clamp-3 min-h-[4.1rem] text-sm leading-6 text-[var(--loombus-text-muted)]">{member.bio?.trim() || (member.privateAccount ? "This member has a private account." : "This member has not added a bio yet.")}</p>

                      <div className="mt-4 flex items-center gap-4 border-t border-[var(--loombus-border)] pt-4 text-xs font-semibold text-[var(--loombus-text-muted)]">
                        <span>{member.followerCount} followers</span>
                        <span>{member.followingCount} following</span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button type="button" disabled={working === member.id} onClick={() => void toggleFollow(member)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--loombus-gold-strong)] px-3 text-sm font-bold text-[var(--loombus-gold-contrast)] disabled:opacity-60">
                          {member.requested ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
                          {working === member.id ? "Working…" : member.following ? "Following" : member.requested ? "Requested" : member.privateAccount ? "Request follow" : "Follow"}
                        </button>
                        {member.mutual ? (
                          <button type="button" disabled={openingMessage === member.id} onClick={() => void openMessage(member)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 text-sm font-bold disabled:opacity-60"><MessageCircle className="size-4" /> {openingMessage === member.id ? "Opening…" : "Message"}</button>
                        ) : (
                          <Link href={href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 text-sm font-bold"><Users className="size-4" /> View profile</Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : (
              <section className="rounded-[1.75rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">
                <Search className="mx-auto size-9 text-[var(--loombus-gold)]" />
                <h2 className="mt-4 text-2xl font-bold">No members match this view.</h2>
                <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Try All members, broaden the search, or clear the filters.</p>
              </section>
            )}

            <nav className="flex items-center justify-center gap-3" aria-label="People directory pages">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 text-sm font-bold disabled:opacity-40"><ChevronLeft className="size-4" /> Previous</button>
              <span className="text-sm font-semibold text-[var(--loombus-text-muted)]">Page {page}</span>
              <button type="button" disabled={!hasMore} onClick={() => setPage((current) => current + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 text-sm font-bold disabled:opacity-40">Next <ChevronRight className="size-4" /></button>
            </nav>
          </>
        )}
      </div>
    </main>
  );
}
