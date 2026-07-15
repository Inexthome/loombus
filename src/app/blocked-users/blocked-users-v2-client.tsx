"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ProfileAvatar,
  getProfileDisplayName,
} from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

type BlockedProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type BlockedMember = {
  blockId: string;
  blockedAt: string;
  profile: BlockedProfile;
  profileAvailable: boolean;
};

type BlocksResponse = {
  generatedAt?: string;
  count?: number;
  limit?: number;
  items?: BlockedMember[];
  error?: string;
  code?: string;
};

type SortMode = "newest" | "oldest" | "name";
type Notice = { kind: "success" | "error"; text: string } | null;

function formatDate(value: string | null | undefined) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Not available";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Not available";

  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 60_000)
  );

  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return formatDate(value);
}

function searchableText(item: BlockedMember) {
  return [
    item.profile.full_name,
    item.profile.username,
    item.profile.bio,
    item.profileAvailable ? "available profile" : "unavailable profile",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function BlockedUsersV2Client() {
  const [items, setItems] = useState<BlockedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [pendingUnblock, setPendingUnblock] = useState<BlockedMember | null>(null);
  const [workingProfileId, setWorkingProfileId] = useState<string | null>(null);

  const loadBlockedMembers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setNotice(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.replace("/login?next=%2Fblocked-users");
        return;
      }

      const response = await fetch("/api/blocks", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as BlocksResponse;

      if (response.status === 401) {
        window.location.replace("/login?next=%2Fblocked-users");
        return;
      }

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load blocked members.");
      }

      setItems(Array.isArray(result.items) ? result.items : []);
      setGeneratedAt(result.generatedAt ?? null);
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to load blocked members.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadBlockedMembers(false);
  }, [loadBlockedMembers]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? items.filter((item) => searchableText(item).includes(normalizedQuery))
      : [...items];

    return filtered.sort((left, right) => {
      if (sortMode === "name") {
        return getProfileDisplayName(left.profile, "Unavailable member").localeCompare(
          getProfileDisplayName(right.profile, "Unavailable member"),
          undefined,
          { sensitivity: "base" }
        );
      }

      const leftTime = new Date(left.blockedAt).getTime();
      const rightTime = new Date(right.blockedAt).getTime();
      return sortMode === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });
  }, [items, query, sortMode]);

  const newestBlock = useMemo(() => {
    if (items.length === 0) return null;
    return items.reduce((latest, item) => {
      const latestTime = new Date(latest.blockedAt).getTime();
      const itemTime = new Date(item.blockedAt).getTime();
      return itemTime > latestTime ? item : latest;
    });
  }, [items]);

  async function confirmUnblock() {
    if (!pendingUnblock || workingProfileId) return;

    const target = pendingUnblock;
    setWorkingProfileId(target.profile.id);
    setNotice(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.replace("/login?next=%2Fblocked-users");
        return;
      }

      const response = await fetch("/api/blocks/toggle", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUserId: target.profile.id,
          desiredState: false,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        blocked?: boolean;
        error?: string;
      };

      if (response.status === 401) {
        window.location.replace("/login?next=%2Fblocked-users");
        return;
      }

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to unblock this member.");
      }

      if (result.blocked) {
        throw new Error("The member is still blocked. Refresh and try again.");
      }

      setItems((current) =>
        current.filter((item) => item.profile.id !== target.profile.id)
      );
      setPendingUnblock(null);
      setNotice({
        kind: "success",
        text: `${getProfileDisplayName(
          target.profile,
          "The member"
        )} was unblocked.`,
      });
      setGeneratedAt(new Date().toISOString());
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to unblock this member.",
      });
    } finally {
      setWorkingProfileId(null);
    }
  }

  if (loading) {
    return (
      <main className="blocked-users-v2-page">
        <section className="blocked-users-v2-state-card" aria-live="polite">
          <RefreshCw aria-hidden="true" className="is-spinning" />
          <p className="blocked-users-v2-eyebrow">Privacy controls</p>
          <h1>Loading blocked members</h1>
          <p>Verifying your account and preparing your private block list.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="blocked-users-v2-page">
      <div className="blocked-users-v2-shell">
        <Link href="/settings" className="blocked-users-v2-back-link">
          <ArrowLeft aria-hidden="true" />
          Back to Settings
        </Link>

        <header className="blocked-users-v2-hero">
          <div className="blocked-users-v2-hero-copy">
            <p className="blocked-users-v2-eyebrow">Privacy and boundaries</p>
            <h1>Blocked members</h1>
            <p>
              Review the people you blocked and restore access only when it feels
              appropriate. Your block list is private and tied to your account.
            </p>
          </div>

          <div className="blocked-users-v2-hero-actions">
            <button
              type="button"
              className="blocked-users-v2-button blocked-users-v2-button-primary"
              onClick={() => void loadBlockedMembers(true)}
              disabled={refreshing}
            >
              <RefreshCw
                aria-hidden="true"
                className={refreshing ? "is-spinning" : undefined}
              />
              {refreshing ? "Refreshing" : "Refresh list"}
            </button>
            <Link
              href="/safety"
              className="blocked-users-v2-button blocked-users-v2-button-quiet"
            >
              <ShieldCheck aria-hidden="true" />
              Safety guide
            </Link>
          </div>
        </header>

        <div className="blocked-users-v2-trust-row" aria-label="Privacy assurances">
          <span>
            <LockKeyhole aria-hidden="true" />
            Private account control
          </span>
          <span>
            <ShieldOff aria-hidden="true" />
            Blocked interactions remain limited
          </span>
          <span>
            <Clock3 aria-hidden="true" />
            Updated {formatRelativeTime(generatedAt)}
          </span>
        </div>

        {notice && (
          <div
            className={`blocked-users-v2-notice is-${notice.kind}`}
            role={notice.kind === "error" ? "alert" : "status"}
          >
            {notice.kind === "error" ? (
              <AlertTriangle aria-hidden="true" />
            ) : (
              <CheckCircle2 aria-hidden="true" />
            )}
            <span>{notice.text}</span>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setNotice(null)}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        )}

        <section className="blocked-users-v2-metrics" aria-label="Block list summary">
          <article>
            <span>Total blocked</span>
            <strong>{items.length}</strong>
            <small>Members currently on your private block list.</small>
          </article>
          <article>
            <span>Visible results</span>
            <strong>{visibleItems.length}</strong>
            <small>Members matching the current search and sort view.</small>
          </article>
          <article>
            <span>Most recent block</span>
            <strong>{newestBlock ? formatDate(newestBlock.blockedAt) : "None"}</strong>
            <small>Unblocking does not automatically restore a follow connection.</small>
          </article>
        </section>

        <section className="blocked-users-v2-workspace">
          <div className="blocked-users-v2-heading-row">
            <div>
              <p className="blocked-users-v2-eyebrow">Management</p>
              <h2>Control who remains blocked.</h2>
              <p>
                Search by name, username, or profile details. Unblocking restores
                normal platform eligibility, but it does not recreate follows,
                messages, or previous interactions.
              </p>
            </div>
          </div>

          {items.length > 0 && (
            <div className="blocked-users-v2-toolbar">
              <label className="blocked-users-v2-search">
                <Search aria-hidden="true" />
                <span className="sr-only">Search blocked members</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search blocked members"
                />
              </label>

              <label className="blocked-users-v2-sort">
                <SlidersHorizontal aria-hidden="true" />
                <span className="sr-only">Sort blocked members</span>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                >
                  <option value="newest">Newest blocked first</option>
                  <option value="oldest">Oldest blocked first</option>
                  <option value="name">Name A to Z</option>
                </select>
              </label>
            </div>
          )}

          {items.length === 0 ? (
            <div className="blocked-users-v2-empty is-primary">
              <UserRoundCheck aria-hidden="true" />
              <h3>No blocked members</h3>
              <p>
                People you block will appear here. You do not need to block anyone
                unless it helps protect your experience or establish a boundary.
              </p>
              <div>
                <Link
                  href="/people"
                  className="blocked-users-v2-button blocked-users-v2-button-primary"
                >
                  <Users aria-hidden="true" />
                  Browse People
                </Link>
                <Link
                  href="/settings"
                  className="blocked-users-v2-button blocked-users-v2-button-quiet"
                >
                  Settings
                </Link>
              </div>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="blocked-users-v2-empty">
              <Search aria-hidden="true" />
              <h3>No blocked member matches that search</h3>
              <p>Clear the search or change the sort order to review the full list.</p>
              <button
                type="button"
                className="blocked-users-v2-button blocked-users-v2-button-quiet"
                onClick={() => setQuery("")}
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="blocked-users-v2-grid">
              {visibleItems.map((item) => {
                const displayName = getProfileDisplayName(
                  item.profile,
                  "Unavailable member"
                );
                const isWorking = workingProfileId === item.profile.id;

                return (
                  <article key={item.blockId} className="blocked-users-v2-card">
                    <div className="blocked-users-v2-card-topline">
                      <span>
                        <ShieldOff aria-hidden="true" />
                        Blocked
                      </span>
                      <small>{formatDate(item.blockedAt)}</small>
                    </div>

                    <div className="blocked-users-v2-profile-row">
                      <ProfileAvatar profile={item.profile} size="xl" />
                      <div>
                        <h3>{displayName}</h3>
                        <p>
                          {item.profile.username
                            ? `@${item.profile.username}`
                            : item.profileAvailable
                              ? "No username"
                              : "Profile unavailable"}
                        </p>
                      </div>
                    </div>

                    <p className="blocked-users-v2-bio">
                      {item.profile.bio ||
                        (item.profileAvailable
                          ? "This member has not added a bio."
                          : "The profile is unavailable, but the block can still be removed safely.")}
                    </p>

                    <div className="blocked-users-v2-card-footer">
                      {item.profileAvailable && item.profile.username ? (
                        <Link href={`/u/${encodeURIComponent(item.profile.username)}`}>
                          View profile
                          <ExternalLink aria-hidden="true" />
                        </Link>
                      ) : (
                        <span>Profile link unavailable</span>
                      )}

                      <button
                        type="button"
                        className="blocked-users-v2-unblock-button"
                        onClick={() => setPendingUnblock(item)}
                        disabled={isWorking}
                      >
                        {isWorking ? (
                          <RefreshCw aria-hidden="true" className="is-spinning" />
                        ) : (
                          <UserRoundCheck aria-hidden="true" />
                        )}
                        {isWorking ? "Updating" : "Unblock"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="blocked-users-v2-explainer">
          <ShieldCheck aria-hidden="true" />
          <div>
            <h2>What changes when you unblock someone?</h2>
            <p>
              The member becomes eligible for ordinary Loombus interactions again.
              Previous follows are not restored automatically, and either person can
              still use reporting, muting, or blocking tools when needed.
            </p>
          </div>
          <Link href="/guidelines">Review Guidelines</Link>
        </section>
      </div>

      {pendingUnblock && (
        <div
          className="blocked-users-v2-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !workingProfileId) {
              setPendingUnblock(null);
            }
          }}
        >
          <section
            className="blocked-users-v2-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="blocked-users-v2-dialog-title"
          >
            <span className="blocked-users-v2-dialog-icon">
              <UserRoundCheck aria-hidden="true" />
            </span>
            <p className="blocked-users-v2-eyebrow">Confirm unblock</p>
            <h2 id="blocked-users-v2-dialog-title">
              Unblock {getProfileDisplayName(pendingUnblock.profile, "this member")}?
            </h2>
            <p>
              They will become eligible for normal platform interactions again. This
              does not restore previous follow relationships or conversations.
            </p>
            <div className="blocked-users-v2-dialog-actions">
              <button
                type="button"
                className="blocked-users-v2-button blocked-users-v2-button-quiet"
                onClick={() => setPendingUnblock(null)}
                disabled={Boolean(workingProfileId)}
              >
                Keep blocked
              </button>
              <button
                type="button"
                className="blocked-users-v2-button blocked-users-v2-button-primary"
                onClick={() => void confirmUnblock()}
                disabled={Boolean(workingProfileId)}
              >
                {workingProfileId ? (
                  <RefreshCw aria-hidden="true" className="is-spinning" />
                ) : (
                  <UserRoundCheck aria-hidden="true" />
                )}
                {workingProfileId ? "Unblocking" : "Unblock member"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
