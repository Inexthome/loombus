"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Download,
  FileSearch,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";

type LifecycleOverview = {
  room: {
    id: string;
    name: string;
    status: string;
    plan: string;
    subscriptionStatus: string;
    isArchived: boolean;
    hasStripeSubscription: boolean;
  };
  counts: {
    members: number | null;
    discussions: number | null;
    records: number | null;
    attachments: number | null;
  };
  confirmations: {
    deletePhrase: string;
  };
  error?: string;
};

type SearchResult = {
  id: string;
  type: string;
  title: string;
  excerpt: string;
  status: string;
  authorId: string | null;
  authorName: string | null;
  fileType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  href: string;
};

type SearchResponse = {
  room?: {
    id: string;
    name: string;
    status: string;
    isOwner: boolean;
  };
  results?: SearchResult[];
  resultCount?: number;
  truncated?: boolean;
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function safeFileName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "room"
  );
}

export default function RoomToolsClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );

  const [overview, setOverview] = useState<LifecycleOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [author, setAuthor] = useState("");
  const [fileType, setFileType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchCount, setSearchCount] = useState(0);
  const [searchTruncated, setSearchTruncated] = useState(false);

  const sessionToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(
        `/rooms/${roomId}/tools`
      )}`;
      return null;
    }
    return token;
  }, [roomId]);

  const loadOverview = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError("");
    try {
      const token = await sessionToken();
      if (!token) return;
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/lifecycle`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      const result = (await response.json().catch(() => ({}))) as LifecycleOverview;
      if (!response.ok) {
        throw new Error(result.error ?? "Room controls could not be loaded.");
      }
      setOverview(result);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Room controls could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [roomId, sessionToken]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function runSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!roomId || searching) return;
    setSearching(true);
    setError("");
    setMessage("");
    try {
      const token = await sessionToken();
      if (!token) return;
      const searchParams = new URLSearchParams({
        q: query,
        type,
        status,
        author,
        fileType,
        dateFrom,
        dateTo,
      });
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/search?${searchParams.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      const result = (await response.json().catch(() => ({}))) as SearchResponse;
      if (!response.ok) {
        throw new Error(result.error ?? "Room search could not be completed.");
      }
      setSearchResults(Array.isArray(result.results) ? result.results : []);
      setSearchCount(result.resultCount ?? 0);
      setSearchTruncated(Boolean(result.truncated));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Room search could not be completed."
      );
    } finally {
      setSearching(false);
    }
  }

  async function runLifecycle(
    action: "archive" | "restore" | "delete" | "export"
  ) {
    if (!roomId || working) return;
    setWorking(action);
    setError("");
    setMessage("");
    try {
      const token = await sessionToken();
      if (!token) return;
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/lifecycle`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            confirmation: deleteConfirmation,
          }),
        }
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
        redirect?: string;
        exportedAt?: string;
        room?: Record<string, unknown>;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Room lifecycle action failed.");
      }

      if (action === "export") {
        const blob = new Blob([JSON.stringify(result, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${safeFileName(overview?.room.name ?? "room")}-export-${new Date()
          .toISOString()
          .slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        setMessage(
          "Room export downloaded. Attachment links in the export remain valid for one hour."
        );
        return;
      }

      if (action === "delete") {
        window.location.href = result.redirect ?? "/rooms";
        return;
      }

      setMessage(
        action === "archive"
          ? "The Room is archived. Member access is paused until it is restored."
          : "The Room is active again."
      );
      setDeleteConfirmation("");
      await loadOverview();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Room lifecycle action failed."
      );
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return (
      <main className="rooms-live-page">
        <section className="rooms-live-state-card">
          <Loader2 aria-hidden="true" className="is-spinning" />
          <h1>Loading Room tools…</h1>
          <p>Verifying owner access and Room lifecycle state.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="rooms-live-page">
      <div className="rooms-live-shell">
        <Link href={`/rooms/${roomId}`} className="rooms-live-back-link">
          <ArrowLeft aria-hidden="true" />
          Back to Room
        </Link>

        <header className="room-workspace-hero">
          <div>
            <p className="rooms-live-eyebrow">Room tools</p>
            <h1>{overview?.room.name ?? "Room search and lifecycle"}</h1>
            <p>
              Search private Room content, export owner data, and control the Room
              lifecycle.
            </p>
          </div>
          <button
            type="button"
            className="rooms-live-secondary-action"
            onClick={() => void loadOverview()}
            disabled={loading}
          >
            <RefreshCw aria-hidden="true" />
            Refresh
          </button>
        </header>

        {error ? <div className="rooms-live-notice is-error">{error}</div> : null}
        {message ? <div className="rooms-live-notice">{message}</div> : null}

        {overview ? (
          <section className="room-workspace-metrics">
            <article>
              <span>Status</span>
              <strong>{overview.room.status}</strong>
            </article>
            <article>
              <span>Members</span>
              <strong>{overview.counts.members ?? "Unavailable"}</strong>
            </article>
            <article>
              <span>Discussions</span>
              <strong>{overview.counts.discussions ?? "Unavailable"}</strong>
            </article>
            <article>
              <span>Files</span>
              <strong>{overview.counts.attachments ?? "Unavailable"}</strong>
            </article>
          </section>
        ) : null}

        <section className="room-workspace-panel">
          <div className="room-workspace-section-heading">
            <div>
              <p className="rooms-live-eyebrow">Private Room search</p>
              <h2>Search everything in this Room</h2>
              <p>
                Results respect membership, plan modules, directory settings, and
                private Customer Support case boundaries.
              </p>
            </div>
            <FileSearch aria-hidden="true" />
          </div>

          <form onSubmit={runSearch} className="rooms-live-access-form">
            <label htmlFor="room-search-query">Search terms</label>
            <input
              id="room-search-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search discussions, replies, files, members, requests, tasks, forms, and resources"
              maxLength={200}
            />

            <div className="room-workspace-overview-grid">
              <label>
                Content type
                <select value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="all">All content</option>
                  <option value="discussion">Discussions</option>
                  <option value="reply">Replies</option>
                  <option value="file">Files</option>
                  <option value="member">Members</option>
                  <option value="request">Requests</option>
                  <option value="task">Tasks</option>
                  <option value="resource">Resources</option>
                  <option value="knowledge">Knowledge</option>
                  <option value="form">Forms</option>
                  <option value="event">Events</option>
                  <option value="announcement">Announcements</option>
                </select>
              </label>
              <label>
                Status
                <input
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  placeholder="all, open, completed"
                  maxLength={50}
                />
              </label>
              <label>
                Author user id
                <input
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="Optional exact user id"
                  maxLength={100}
                />
              </label>
              <label>
                File type
                <input
                  value={fileType}
                  onChange={(event) => setFileType(event.target.value)}
                  placeholder="pdf, image, video"
                  maxLength={100}
                />
              </label>
              <label>
                From
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
            </div>

            <button
              type="submit"
              className="rooms-live-primary-action"
              disabled={searching}
            >
              {searching ? (
                <Loader2 aria-hidden="true" className="is-spinning" />
              ) : (
                <Search aria-hidden="true" />
              )}
              {searching ? "Searching" : "Search Room"}
            </button>
          </form>

          <div className="room-workspace-section-heading">
            <div>
              <h3>{searchCount} results</h3>
              {searchTruncated ? (
                <p>The newest 250 matching results are shown.</p>
              ) : null}
            </div>
          </div>

          <div className="room-workspace-announcement-list">
            {searchResults.map((result) => (
              <article key={`${result.type}:${result.id}`}>
                <div>
                  <span>{result.type.replaceAll("_", " ")}</span>
                  <strong>{result.title}</strong>
                  <p>{result.excerpt || "No preview text available."}</p>
                  <small>
                    {result.authorName ? `${result.authorName} · ` : ""}
                    {result.status} · {formatDate(result.updatedAt ?? result.createdAt)}
                  </small>
                </div>
                <Link href={result.href}>Open</Link>
              </article>
            ))}
            {!searching && searchResults.length === 0 ? (
              <p>Run a search to review matching Room content.</p>
            ) : null}
          </div>
        </section>

        {overview ? (
          <section className="room-workspace-panel">
            <div className="room-workspace-section-heading">
              <div>
                <p className="rooms-live-eyebrow">Owner export</p>
                <h2>Export Room data</h2>
                <p>
                  Downloads Room records as JSON and includes temporary signed
                  attachment links when storage metadata is available.
                </p>
              </div>
              <Download aria-hidden="true" />
            </div>
            <button
              type="button"
              className="rooms-live-secondary-action"
              disabled={Boolean(working)}
              onClick={() => void runLifecycle("export")}
            >
              {working === "export" ? (
                <Loader2 aria-hidden="true" className="is-spinning" />
              ) : (
                <Download aria-hidden="true" />
              )}
              Download export
            </button>
          </section>
        ) : null}

        {overview ? (
          <section className="room-workspace-panel">
            <div className="room-workspace-section-heading">
              <div>
                <p className="rooms-live-eyebrow">Lifecycle</p>
                <h2>Archive or restore this Room</h2>
                <p>
                  Archiving pauses all member and workspace access without deleting
                  Room content. The owner can export or restore it from this page.
                </p>
              </div>
              {overview.room.isArchived ? (
                <RotateCcw aria-hidden="true" />
              ) : (
                <Archive aria-hidden="true" />
              )}
            </div>
            <button
              type="button"
              className="rooms-live-secondary-action"
              disabled={Boolean(working)}
              onClick={() =>
                void runLifecycle(overview.room.isArchived ? "restore" : "archive")
              }
            >
              {working === "archive" || working === "restore" ? (
                <Loader2 aria-hidden="true" className="is-spinning" />
              ) : overview.room.isArchived ? (
                <RotateCcw aria-hidden="true" />
              ) : (
                <Archive aria-hidden="true" />
              )}
              {overview.room.isArchived ? "Restore Room" : "Archive Room"}
            </button>
          </section>
        ) : null}

        {overview?.room.isArchived ? (
          <section className="room-workspace-panel">
            <div className="room-workspace-section-heading">
              <div>
                <p className="rooms-live-eyebrow">Permanent removal</p>
                <h2>Delete this archived Room</h2>
                <p>
                  Deletion removes member access and hides the Room. It is blocked
                  while a paid Stripe subscription remains active.
                </p>
              </div>
              <ShieldAlert aria-hidden="true" />
            </div>
            <label htmlFor="room-delete-confirmation">
              Type <strong>{overview.confirmations.deletePhrase}</strong>
            </label>
            <input
              id="room-delete-confirmation"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              className="rooms-live-primary-action"
              disabled={
                Boolean(working) ||
                deleteConfirmation !== overview.confirmations.deletePhrase
              }
              onClick={() => void runLifecycle("delete")}
            >
              {working === "delete" ? (
                <Loader2 aria-hidden="true" className="is-spinning" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              Delete Room
            </button>
          </section>
        ) : null}
      </div>
    </main>
  );
}
