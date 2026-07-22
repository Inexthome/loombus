"use client";

import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Search,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type MouseEvent } from "react";

export type MemberConnectionsMode = "followers" | "following";

type PublicProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type ConnectionItem = {
  profile: PublicProfile;
  viewerFollows: boolean;
  followsViewer: boolean;
  mutual: boolean;
};

type ConnectionsPayload = {
  mode: MemberConnectionsMode;
  viewerId: string;
  viewerIsOwner: boolean;
  owner: PublicProfile;
  counts: {
    followers: number;
    following: number;
  };
  items: ConnectionItem[];
};

type PageState = "loading" | "ready" | "signed-out" | "not-found" | "error";

function profileName(profile: PublicProfile) {
  return getProfileDisplayName(profile);
}

function relationshipLabel(item: ConnectionItem) {
  if (item.mutual) return "Connection";
  if (item.followsViewer) return "Follows you";
  if (item.viewerFollows) return "Following";
  return null;
}

function safeUsername(value: string | undefined) {
  const source = String(value ?? "");
  try {
    return decodeURIComponent(source).trim();
  } catch {
    return source.trim();
  }
}

export default function MemberConnectionsV2({
  mode,
}: {
  mode: MemberConnectionsMode;
}) {
  const params = useParams<{ username: string }>();
  const username = safeUsername(params?.username);
  const [payload, setPayload] = useState<ConnectionsPayload | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadConnections() {
      setPageState("loading");
      setNotice("");

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        if (active) setPageState("signed-out");
        return;
      }

      try {
        const response = await fetch(
          `/api/member-connections?username=${encodeURIComponent(username)}&mode=${mode}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }
        );
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (response.status === 401) {
            if (active) setPageState("signed-out");
            return;
          }

          if (response.status === 404) {
            if (active) setPageState("not-found");
            return;
          }

          throw new Error(result.error ?? "Unable to load this member network.");
        }

        if (!active) return;
        setPayload(result as ConnectionsPayload);
        setPageState("ready");
      } catch (error) {
        if (!active) return;
        setNotice(
          error instanceof Error
            ? error.message
            : "Unable to load this member network."
        );
        setPageState("error");
      }
    }

    void loadConnections();

    return () => {
      active = false;
    };
  }, [mode, reloadKey, username]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!payload) return [];

    return payload.items
      .filter((item) => {
        if (!needle) return true;
        return [
          item.profile.full_name,
          item.profile.username,
          item.profile.bio,
          relationshipLabel(item),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => profileName(a.profile).localeCompare(profileName(b.profile)));
  }, [payload, query]);

  const mutualCount = useMemo(
    () => payload?.items.filter((item) => item.mutual).length ?? 0,
    [payload]
  );

  async function toggleFollow(
    event: MouseEvent<HTMLButtonElement>,
    item: ConnectionItem
  ) {
    event.preventDefault();
    if (!payload || workingId || item.profile.id === payload.viewerId) return;

    setWorkingId(item.profile.id);
    setNotice("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        window.location.href = `/login?next=${encodeURIComponent(
          `/u/${username}/${mode}`
        )}`;
        return;
      }

      const response = await fetch("/api/follows/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ targetUserId: item.profile.id }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to update follow status.");
      }

      const following = Boolean(result.following);

      setPayload((current) => {
        if (!current) return current;

        const removeFromOwnFollowing =
          current.viewerIsOwner && mode === "following" && !following;

        const items = removeFromOwnFollowing
          ? current.items.filter(
              (candidate) => candidate.profile.id !== item.profile.id
            )
          : current.items.map((candidate) =>
              candidate.profile.id === item.profile.id
                ? {
                    ...candidate,
                    viewerFollows: following,
                    mutual: following && candidate.followsViewer,
                  }
                : candidate
            );

        return {
          ...current,
          counts: removeFromOwnFollowing
            ? {
                ...current.counts,
                following: Math.max(0, current.counts.following - 1),
              }
            : current.counts,
          items,
        };
      });

      setNotice(
        following
          ? `Following ${profileName(item.profile)}.`
          : `Unfollowed ${profileName(item.profile)}.`
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update follow status."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function openMessage(
    event: MouseEvent<HTMLButtonElement>,
    item: ConnectionItem
  ) {
    event.preventDefault();
    if (!payload || openingId || !item.mutual) return;

    setOpeningId(item.profile.id);
    setNotice("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        window.location.href = `/login?next=${encodeURIComponent(
          `/u/${username}/${mode}`
        )}`;
        return;
      }

      const response = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ targetUserId: item.profile.id }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to start message.");
      }

      window.location.href = `/messages?conversation=${encodeURIComponent(
        String(result.conversationId)
      )}`;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to start message."
      );
      setOpeningId(null);
    }
  }

  const title = mode === "followers" ? "Followers" : "Following";
  const routePath = `/u/${username}/${mode}`;

  if (pageState === "loading") {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-4 text-[var(--loombus-text)] sm:px-6 sm:py-10 lg:px-8">
        <section className="mx-auto max-w-6xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-7 shadow-xl shadow-black/5 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--loombus-gold)]">
            Member network
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" />
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
              Loading {title.toLowerCase()}…
            </h1>
          </div>
        </section>
      </main>
    );
  }

  if (pageState === "signed-out") {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-4 text-[var(--loombus-text)] sm:px-6 sm:py-10 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-7 shadow-xl shadow-black/5 sm:p-10">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
            <LockKeyhole className="h-6 w-6" />
          </span>
          <p className="mt-6 text-xs font-black uppercase tracking-[.22em] text-[var(--loombus-gold)]">
            Members only
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
            Log in to view {title.toLowerCase()}.
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--loombus-text-muted)]">
            Follow lists remain inside the signed-in Loombus member network.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/login?next=${encodeURIComponent(routePath)}`}
              className="rounded-full bg-[var(--loombus-gold-strong)] px-6 py-3 text-sm font-black text-[var(--loombus-gold-contrast)]"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full border border-[var(--loombus-border)] px-6 py-3 text-sm font-black"
            >
              Create account
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (pageState === "not-found") {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-4 text-[var(--loombus-text)] sm:px-6 sm:py-10 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-7 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--loombus-gold)]">
            Profile unavailable
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
            This member network could not be found.
          </h1>
          <p className="mt-4 leading-7 text-[var(--loombus-text-muted)]">
            The profile may be unavailable, or the relationship is not visible
            to your account.
          </p>
          <Link
            href="/people"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold-strong)] px-6 py-3 text-sm font-black text-[var(--loombus-gold-contrast)]"
          >
            Browse people
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    );
  }

  if (pageState === "error" || !payload) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-4 text-[var(--loombus-text)] sm:px-6 sm:py-10 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-7 sm:p-10">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
            <RefreshCw className="h-6 w-6" />
          </span>
          <p className="mt-6 text-xs font-black uppercase tracking-[.22em] text-[var(--loombus-gold)]">
            Network unavailable
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
            This follow list could not load.
          </h1>
          <p className="mt-4 leading-7 text-[var(--loombus-text-muted)]">
            {notice || "Refresh the member network and try again."}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold-strong)] px-6 py-3 text-sm font-black text-[var(--loombus-gold-contrast)]"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </section>
      </main>
    );
  }

  const ownerName = profileName(payload.owner);
  const emptyDescription =
    mode === "followers"
      ? `${ownerName} does not have visible followers yet.`
      : `${ownerName} is not following any visible members yet.`;

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-28 pt-4 text-[var(--loombus-text)] sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <Link
          href={`/u/${payload.owner.username}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>

        <header className="overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[radial-gradient(circle_at_top_left,var(--loombus-cream-soft),transparent_30rem),radial-gradient(circle_at_top_right,var(--loombus-gold-soft),transparent_28rem),var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-9">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--loombus-gold)]">
                Member network
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-[-.045em] sm:text-6xl">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl leading-7 text-[var(--loombus-text-muted)]">
                Review the visible members connected to {ownerName}, understand
                the relationship context, and continue useful connections.
              </p>
            </div>

            <Link
              href={`/u/${payload.owner.username}`}
              className="flex min-w-0 items-center gap-4 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-4 transition hover:border-[var(--loombus-gold)]"
            >
              <ProfileAvatar profile={payload.owner} size="xl" />
              <div className="min-w-0">
                <p className="truncate font-black">{ownerName}</p>
                <p className="mt-1 truncate text-sm text-[var(--loombus-text-muted)]">
                  @{payload.owner.username}
                </p>
              </div>
              <ChevronRight className="ml-auto h-5 w-5 shrink-0 text-[var(--loombus-gold)]" />
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-3 gap-3">
          {[
            ["Followers", payload.counts.followers],
            ["Following", payload.counts.following],
            ["Mutual here", mutualCount],
          ].map(([label, value]) => (
            <article
              key={String(label)}
              className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 sm:p-5"
            >
              <p className="text-[0.68rem] font-black uppercase tracking-[.14em] text-[var(--loombus-text-subtle)]">
                {label}
              </p>
              <p className="mt-2 text-2xl font-black sm:text-3xl">{value}</p>
            </article>
          ))}
        </section>

        <nav
          aria-label={`${ownerName} network views`}
          className="flex gap-2 overflow-x-auto rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2"
        >
          {(["followers", "following"] as const).map((tab) => {
            const active = tab === mode;
            const label = tab === "followers" ? "Followers" : "Following";

            return (
              <Link
                key={tab}
                href={`/u/${payload.owner.username}/${tab}`}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-[10rem] flex-1 items-center justify-between rounded-2xl px-4 py-3 text-sm font-black transition ${
                  active
                    ? "bg-[var(--loombus-gold-strong)] text-[var(--loombus-gold-contrast)]"
                    : "text-[var(--loombus-text-muted)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                }`}
              >
                <span>{label}</span>
                <span>{payload.counts[tab]}</span>
              </Link>
            );
          })}
        </nav>

        {notice ? (
          <div
            role="status"
            className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm font-medium text-[var(--loombus-text-muted)]"
          >
            {notice}
          </div>
        ) : null}

        {payload.items.length > 0 ? (
          <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 sm:p-5">
            <label className="relative block">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--loombus-text-subtle)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${title.toLowerCase()} by name, username, bio, or relationship`}
                className="min-h-12 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] py-3 pl-12 pr-4 text-sm outline-none transition focus:border-[var(--loombus-gold)]"
              />
            </label>
            <div className="mt-3 flex items-center justify-between gap-4 text-xs font-bold text-[var(--loombus-text-subtle)]">
              <span>
                Showing {visibleItems.length} of {payload.items.length}{" "}
                {payload.items.length === 1 ? "member" : "members"}
              </span>
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="shrink-0 text-[var(--loombus-gold)]"
                >
                  Clear search
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {payload.items.length === 0 ? (
          <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center sm:p-12">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
              <Users className="h-7 w-7" />
            </span>
            <h2 className="mt-5 text-2xl font-black">
              No visible {title.toLowerCase()} yet.
            </h2>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-[var(--loombus-text-muted)]">
              {emptyDescription}
            </p>
            <Link
              href="/people"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold-strong)] px-5 py-3 text-sm font-black text-[var(--loombus-gold-contrast)]"
            >
              Browse people
              <ChevronRight className="h-4 w-4" />
            </Link>
          </section>
        ) : visibleItems.length === 0 ? (
          <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
            <h2 className="text-2xl font-black">No members match this search.</h2>
            <p className="mt-3 text-[var(--loombus-text-muted)]">
              Try a broader name, username, bio phrase, or relationship label.
            </p>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => {
              const badge = relationshipLabel(item);
              const isSelf = item.profile.id === payload.viewerId;
              const followWorking = workingId === item.profile.id;
              const messageWorking = openingId === item.profile.id;

              return (
                <article
                  key={item.profile.id}
                  className="flex min-w-0 flex-col rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-lg shadow-black/5 transition hover:border-[color:color-mix(in_srgb,var(--loombus-gold)_45%,var(--loombus-border))]"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <Link
                      href={
                        item.profile.username
                          ? `/u/${item.profile.username}`
                          : "/people"
                      }
                      className="shrink-0"
                      aria-label={`Open ${profileName(item.profile)} profile`}
                    >
                      <ProfileAvatar profile={item.profile} size="xl" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={
                          item.profile.username
                            ? `/u/${item.profile.username}`
                            : "/people"
                        }
                        className="block"
                      >
                        <h2 className="truncate text-xl font-black">
                          {profileName(item.profile)}
                        </h2>
                        <p className="mt-1 truncate text-sm font-medium text-[var(--loombus-text-muted)]">
                          {item.profile.username
                            ? `@${item.profile.username}`
                            : "Profile unavailable"}
                        </p>
                      </Link>
                      {badge ? (
                        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-black text-[var(--loombus-gold)]">
                          {item.mutual ? (
                            <UserCheck className="h-3.5 w-3.5" />
                          ) : (
                            <UserPlus className="h-3.5 w-3.5" />
                          )}
                          {badge}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-5 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {item.profile.bio?.trim() || "No bio added yet."}
                  </p>

                  <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--loombus-border)] pt-4">
                    <Link
                      href={
                        item.profile.username
                          ? `/u/${item.profile.username}`
                          : "/people"
                      }
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 py-2.5 text-xs font-black transition hover:bg-[var(--loombus-surface-muted)]"
                    >
                      View profile
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>

                    {!isSelf ? (
                      <button
                        type="button"
                        onClick={(event) => toggleFollow(event, item)}
                        disabled={followWorking}
                        aria-pressed={item.viewerFollows}
                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition disabled:opacity-60 ${
                          item.viewerFollows
                            ? "border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)]"
                            : "bg-[var(--loombus-gold-strong)] text-[var(--loombus-gold-contrast)]"
                        }`}
                      >
                        {followWorking ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : item.viewerFollows ? (
                          <UserCheck className="h-3.5 w-3.5" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5" />
                        )}
                        {item.viewerFollows ? "Following" : "Follow"}
                      </button>
                    ) : null}

                    {!isSelf && item.mutual ? (
                      <button
                        type="button"
                        onClick={(event) => openMessage(event, item)}
                        disabled={messageWorking}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--loombus-gold)] px-3 py-2.5 text-xs font-black text-[var(--loombus-gold)] transition hover:bg-[var(--loombus-gold-surface)] disabled:opacity-60"
                      >
                        {messageWorking ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <MessageCircle className="h-3.5 w-3.5" />
                        )}
                        Message connection
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[var(--loombus-gold)]" />
            <div>
              <h2 className="font-black">Member-network boundary</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                Follow lists require a signed-in account. Blocked relationships
                remain excluded, and private messaging continues through the
                existing mutual-connection rules.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
