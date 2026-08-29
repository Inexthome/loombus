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

function relationshipLabel(member: Member) {
  if (member.mutual) return "Mutual";
  if (member.following && member.followsYou) return "Mutual";
  if (member.following) return "Following";
  if (member.followsYou) return "Follows you";
  if (member.requested) return "Requested";
  return "—";
}

async function getSessionToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function PeopleEditorialClient() {
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

      const params = new URLSearchParams({ page: String(page), pageSize: "48" });
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
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-5 py-10 text-[var(--loombus-text)] sm:px-8">
        <section className="mx-auto max-w-6xl border-b border-[var(--loombus-border)] pb-10">
          <p className="text-xs font-semibold uppercase tracking-[.24em] text-[var(--loombus-gold)]">People</p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-.04em] sm:text-5xl">Loading the member directory…</h1>
        </section>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-5 py-10 text-[var(--loombus-text)] sm:px-8">
        <section className="mx-auto max-w-4xl border-y border-[var(--loombus-border)] py-12">
          <p className="text-xs font-semibold uppercase tracking-[.24em] text-[var(--loombus-gold)]">Members only</p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-.04em] sm:text-5xl">Log in to browse Loombus members.</h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--loombus-text-muted)]">The directory is visible inside Loombus while undiscoverable accounts and blocked relationships remain hidden.</p>
          <Link href="/login?next=/people" className="mt-7 inline-flex min-h-11 items-center border-b-2 border-[var(--loombus-gold)] font-semibold">Log in to People</Link>
        </section>
      </main>
    );
  }

  return (
    <main data-people-editorial="directory" className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-7 sm:pt-10 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-[var(--loombus-border)] pb-8 sm:pb-10">
          <p className="text-xs font-semibold uppercase tracking-[.24em] text-[var(--loombus-gold)]">Loombus member directory</p>
          <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-4xl font-bold tracking-[-.045em] sm:text-6xl">Find people worth following.</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--loombus-text-muted)]">Discover members by identity, experience, and relationship. Private accounts still require approval before you can follow them.</p>
            </div>
            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold" aria-label="People links">
              <Link href="/following" className="border-b border-transparent pb-1 hover:border-[var(--loombus-gold)]">Following feed</Link>
              <Link href="/settings?section=privacy-safety" className="border-b border-transparent pb-1 hover:border-[var(--loombus-gold)]">Privacy settings</Link>
            </nav>
          </div>
        </header>

        <section className="grid grid-cols-2 border-b border-[var(--loombus-border)] sm:grid-cols-5" aria-label="People relationship summary">
          {[
            ["On this page", metrics.visible],
            ["Following", metrics.following],
            ["Followers", metrics.followers],
            ["Mutual", metrics.mutual],
            ["Requested", metrics.requested],
          ].map(([label, value], index) => (
            <div key={label} className={`py-5 ${index > 0 ? "sm:border-l sm:border-[var(--loombus-border)] sm:pl-5" : ""}`}>
              <p className="text-[.68rem] font-semibold uppercase tracking-[.18em] text-[var(--loombus-text-subtle)]">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        {notice ? <div className="border-b border-[var(--loombus-border)] py-4 text-sm text-[var(--loombus-text-muted)]" role="status">{notice}</div> : null}

        <section className="border-b border-[var(--loombus-border)] py-6">
          <div className="flex gap-6 overflow-x-auto" role="tablist" aria-label="People directory views">
            {VIEWS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => selectView(key)}
                className={`shrink-0 border-b-2 pb-2 text-sm font-semibold transition-colors ${view === key ? "border-[var(--loombus-gold)] text-[var(--loombus-text)]" : "border-transparent text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {view !== "requests" ? (
            <form onSubmit={submitSearch} className="mt-6 grid gap-x-5 gap-y-4 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_11rem_auto] lg:items-end">
              <label className="block">
                <span className="mb-2 block text-[.68rem] font-semibold uppercase tracking-[.16em] text-[var(--loombus-text-subtle)]">Search members</span>
                <span className="flex border-b border-[var(--loombus-border)] focus-within:border-[var(--loombus-gold)]">
                  <Search className="mt-3 size-4 shrink-0 text-[var(--loombus-text-subtle)]" aria-hidden="true" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, username, or bio" className="min-h-11 w-full bg-transparent px-3 text-sm outline-none" />
                </span>
              </label>
              <label className="block">
                <span className="mb-2 block text-[.68rem] font-semibold uppercase tracking-[.16em] text-[var(--loombus-text-subtle)]">Sort</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="min-h-11 w-full border-0 border-b border-[var(--loombus-border)] bg-transparent px-0 text-sm outline-none focus:border-[var(--loombus-gold)]"><option value="recommended">Recommended</option><option value="name">Name A–Z</option><option value="followers">Most followed</option></select>
              </label>
              <label className="block">
                <span className="mb-2 block text-[.68rem] font-semibold uppercase tracking-[.16em] text-[var(--loombus-text-subtle)]">Role</span>
                <select value={role} onChange={(event) => setRole(event.target.value as Role)} className="min-h-11 w-full border-0 border-b border-[var(--loombus-border)] bg-transparent px-0 text-sm outline-none focus:border-[var(--loombus-gold)]"><option value="all">All roles</option><option value="member">Members</option><option value="admin">Admins</option></select>
              </label>
              <label className="block">
                <span className="mb-2 block text-[.68rem] font-semibold uppercase tracking-[.16em] text-[var(--loombus-text-subtle)]">Profile</span>
                <select value={quality} onChange={(event) => setQuality(event.target.value as Quality)} className="min-h-11 w-full border-0 border-b border-[var(--loombus-border)] bg-transparent px-0 text-sm outline-none focus:border-[var(--loombus-gold)]"><option value="all">All profiles</option><option value="bio">With bio</option><option value="complete">Complete profiles</option></select>
              </label>
              <button type="submit" className="min-h-11 border-b-2 border-[var(--loombus-gold)] px-1 text-sm font-semibold">Search</button>
            </form>
          ) : (
            <p className="mt-5 text-sm text-[var(--loombus-text-muted)]">Review incoming requests or manage requests you sent to private accounts.</p>
          )}
        </section>

        {view === "requests" ? (
          <PeopleFollowRequestsPanel />
        ) : (
          <>
            <div className="flex flex-col gap-2 border-b border-[var(--loombus-border)] py-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-semibold">{filteredMembers.length} shown · {total} discoverable members</p>
                <p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">{adminVisibility ? "Admin visibility includes active undiscoverable accounts." : "Undiscoverable accounts and blocked relationships are excluded."}</p>
              </div>
              {activeQuery ? <button type="button" onClick={() => { setQuery(""); setActiveQuery(""); setPage(1); }} className="self-start border-b border-[var(--loombus-border)] pb-1 text-sm font-semibold text-[var(--loombus-text-muted)] sm:self-auto">Clear search</button> : null}
            </div>

            {filteredMembers.length ? (
              <section className="overflow-x-auto border-b border-[var(--loombus-border)]" aria-label="People directory results">
                <div role="table" aria-label="People directory table" className="min-w-[860px]">
                  <div role="row" className="grid grid-cols-[minmax(260px,2fr)_minmax(130px,1fr)_110px_110px_minmax(230px,auto)] gap-4 border-b border-[var(--loombus-border)] py-3 text-[.68rem] font-semibold uppercase tracking-[.16em] text-[var(--loombus-text-subtle)]">
                    <div role="columnheader">Member</div>
                    <div role="columnheader">Relationship</div>
                    <div role="columnheader" className="text-right">Followers</div>
                    <div role="columnheader" className="text-right">Following</div>
                    <div role="columnheader" className="text-right">Actions</div>
                  </div>

                  {filteredMembers.map((member) => {
                    const profile = { id: member.id, full_name: member.fullName, username: member.username, avatar_url: member.avatarUrl };
                    const href = member.username ? `/u/${encodeURIComponent(member.username)}` : "/people";
                    return (
                      <div key={member.id} role="row" className="grid grid-cols-[minmax(260px,2fr)_minmax(130px,1fr)_110px_110px_minmax(230px,auto)] items-center gap-4 border-b border-[var(--loombus-border)] py-4 last:border-b-0">
                        <div role="cell" className="flex min-w-0 items-center gap-3">
                          <Link href={href} className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)]"><ProfileAvatar profile={profile} size="md" /></Link>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <Link href={href} className="truncate font-semibold hover:underline">{displayName(member)}</Link>
                              {member.isAdmin ? <span className="inline-flex shrink-0 items-center gap-1 text-[.65rem] font-semibold uppercase tracking-[.1em] text-[var(--loombus-gold)]"><ShieldCheck className="size-3" aria-hidden="true" /> Admin</span> : null}
                              {member.privateAccount ? <LockKeyhole className="size-3 shrink-0 text-[var(--loombus-text-subtle)]" aria-label="Private account" /> : null}
                            </div>
                            <p className="mt-1 truncate text-xs text-[var(--loombus-text-muted)]">{member.username ? `@${member.username}` : "Loombus member"}</p>
                          </div>
                        </div>

                        <div role="cell" className="text-sm text-[var(--loombus-text-muted)]">{relationshipLabel(member)}</div>
                        <div role="cell" className="text-right text-sm font-medium">{member.followerCount}</div>
                        <div role="cell" className="text-right text-sm font-medium">{member.followingCount}</div>
                        <div role="cell" className="flex items-center justify-end gap-4">
                          <button type="button" disabled={working === member.id} onClick={() => void toggleFollow(member)} className="inline-flex min-h-10 items-center gap-2 border-b-2 border-[var(--loombus-gold)] px-1 text-sm font-semibold disabled:opacity-50">
                            {member.requested ? <UserCheck className="size-4" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
                            {working === member.id ? "Working…" : member.following ? "Following" : member.requested ? "Requested" : member.privateAccount ? "Request follow" : "Follow"}
                          </button>
                          {member.mutual ? (
                            <button type="button" disabled={openingMessage === member.id} onClick={() => void openMessage(member)} className="inline-flex min-h-10 items-center gap-2 border-b border-[var(--loombus-border)] px-1 text-sm font-semibold disabled:opacity-50"><MessageCircle className="size-4" aria-hidden="true" /> {openingMessage === member.id ? "Opening…" : "Message"}</button>
                          ) : (
                            <Link href={href} className="inline-flex min-h-10 items-center border-b border-[var(--loombus-border)] px-1 text-sm font-semibold">Profile</Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className="border-b border-[var(--loombus-border)] py-14 text-center">
                <Search className="mx-auto size-8 text-[var(--loombus-gold)]" aria-hidden="true" />
                <h2 className="mt-4 text-2xl font-semibold">No members match this view.</h2>
                <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Try All members, broaden the search, or clear the filters.</p>
              </section>
            )}

            <nav className="flex items-center justify-center gap-6 py-7" aria-label="People directory pages">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex min-h-11 items-center gap-2 border-b border-[var(--loombus-border)] text-sm font-semibold disabled:opacity-40"><ChevronLeft className="size-4" aria-hidden="true" /> Previous</button>
              <span className="text-sm font-semibold text-[var(--loombus-text-muted)]">Page {page}</span>
              <button type="button" disabled={!hasMore} onClick={() => setPage((current) => current + 1)} className="inline-flex min-h-11 items-center gap-2 border-b border-[var(--loombus-border)] text-sm font-semibold disabled:opacity-40">Next <ChevronRight className="size-4" aria-hidden="true" /></button>
            </nav>
          </>
        )}
      </div>
    </main>
  );
}
