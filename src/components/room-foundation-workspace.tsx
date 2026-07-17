"use client";

import {
  Bell,
  BellOff,
  CheckCheck,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { isRoomModuleKey, type RoomModuleKey } from "@/lib/room-plan-entitlements";

type Panel = "search" | "inbox" | null;

type Preferences = {
  muted: boolean;
  importantOnly: boolean;
  lastReadAt: string;
};

type Actor = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
} | null;

type ActivityEvent = {
  id: string;
  actorId: string | null;
  actor: Actor;
  eventType: string;
  moduleKey: string;
  moduleLabel: string;
  targetType: string;
  targetId: string | null;
  title: string;
  summary: string;
  importance: string;
  createdAt: string | null;
};

type SearchResult = {
  moduleKey: string;
  moduleLabel: string;
  targetType: string;
  targetId: string;
  title: string;
  snippet: string;
  createdAt: string | null;
  rank: number;
};

type ActivityPayload = {
  room?: { id: string; name: string };
  preferences?: Preferences;
  unreadCount?: number;
  unreadCapped?: boolean;
  events?: ActivityEvent[];
  error?: string;
};

type SearchPayload = {
  query?: string;
  results?: SearchResult[];
  error?: string;
};

const SEARCH_MODULES: Array<{ value: string; label: string }> = [
  { value: "", label: "Everything" },
  { value: "discussions", label: "Discussions" },
  { value: "calendar", label: "Calendar" },
  { value: "announcements", label: "Announcements" },
  { value: "resources", label: "Resources" },
  { value: "tasks", label: "Tasks" },
  { value: "polls", label: "Polls" },
  { value: "directory", label: "Directory" },
  { value: "knowledge", label: "Knowledge Base" },
  { value: "files", label: "Files" },
  { value: "forms", label: "Forms" },
  { value: "services", label: "Services" },
  { value: "member-workflows", label: "Member Workflows" },
];

const MODULE_LABELS: Partial<Record<RoomModuleKey, string>> = {
  overview: "Overview",
  discussions: "Discussions",
  calendar: "Calendar",
  announcements: "Announcements",
  members: "Members / Roles",
  requests: "Requests",
  resources: "Resources",
  settings: "Settings",
  tasks: "Tasks / Action Items",
  polls: "Polls / Decisions",
  directory: "Directory / Contacts",
  knowledge: "Knowledge Base / FAQ",
  files: "Files / Documents",
  forms: "Forms / Submissions",
  services: "Services / Store",
  invites: "Invites / Join Requests",
  activity: "Activity / Audit Log",
  "advanced-controls": "Advanced Room Controls",
  "admin-tools": "More Admin Tools",
  operations: "Larger Room Operations",
  "member-workflows": "Advanced Member Workflows",
  "enterprise-controls": "Enterprise Controls",
  "high-capacity": "High-Capacity Rooms",
  "community-operations": "Full Private Community Operations",
};

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function actorName(actor: Actor) {
  return actor?.full_name?.trim() || actor?.username?.trim() || "";
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function findFoundationHost() {
  const shell = document.querySelector<HTMLElement>(
    ".rooms-live-page .rooms-live-shell"
  );
  if (!shell) return null;

  let host = shell.querySelector<HTMLElement>(
    "[data-loombus-room-foundation-host='true']"
  );
  if (!host) {
    host = document.createElement("div");
    host.dataset.loombusRoomFoundationHost = "true";
    const insertionPoint =
      shell.querySelector<HTMLElement>(
        "[data-loombus-tier-navigation-host='true']"
      ) ??
      shell.querySelector<HTMLElement>(
        ".room-workspace-tabs:not([data-loombus-tier-navigation='true'])"
      );
    if (insertionPoint) insertionPoint.before(host);
    else shell.prepend(host);
  }
  return host;
}

export function RoomFoundationWorkspace() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [summary, setSummary] = useState<ActivityPayload | null>(null);
  const [inbox, setInbox] = useState<ActivityPayload | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingPanel, setLoadingPanel] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let scheduled = false;
    const scan = () => {
      scheduled = false;
      setHost(findFoundationHost());
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(scan);
    };
    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document
        .querySelector<HTMLElement>(
          "[data-loombus-room-foundation-host='true']"
        )
        ?.remove();
    };
  }, []);

  const request = useCallback(
    async (view: string, init?: RequestInit, extra?: URLSearchParams) => {
      if (!roomId) throw new Error("Room could not be identified.");
      const token = await accessToken();
      if (!token) throw new Error("Sign in again before continuing.");
      const params = extra ?? new URLSearchParams();
      params.set("view", view);
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/foundation?${params.toString()}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
            ...(init?.headers ?? {}),
          },
          cache: "no-store",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as
        | ActivityPayload
        | SearchPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Room activity could not be loaded.");
      }
      return payload;
    },
    [roomId]
  );

  const loadSummary = useCallback(async () => {
    if (!roomId) return;
    setLoadingSummary(true);
    try {
      const payload = (await request("summary")) as ActivityPayload;
      setSummary(payload);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Room activity could not load."
      );
    } finally {
      setLoadingSummary(false);
    }
  }, [request, roomId]);

  const loadInbox = useCallback(async () => {
    setLoadingPanel(true);
    setNotice("");
    try {
      const payload = (await request("inbox")) as ActivityPayload;
      setInbox(payload);
      setSummary(payload);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Room inbox could not load."
      );
    } finally {
      setLoadingPanel(false);
    }
  }, [request]);

  useEffect(() => {
    void loadSummary();
    const interval = window.setInterval(() => void loadSummary(), 60000);
    const refresh = () => void loadSummary();
    window.addEventListener("loombus:room-activity-changed", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("loombus:room-activity-changed", refresh);
    };
  }, [loadSummary]);

  useEffect(() => {
    if (panel === "search") {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
    if (panel === "inbox") void loadInbox();
  }, [loadInbox, panel]);

  async function runSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const cleaned = query.trim();
    if (cleaned.length < 2) {
      setNotice("Enter at least two characters to search this Room.");
      setSearchResults([]);
      return;
    }
    setLoadingPanel(true);
    setNotice("");
    try {
      const params = new URLSearchParams({ q: cleaned });
      if (moduleFilter) params.set("module", moduleFilter);
      const payload = (await request("search", undefined, params)) as SearchPayload;
      setSearchResults(payload.results ?? []);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Room search could not run."
      );
    } finally {
      setLoadingPanel(false);
    }
  }

  async function postAction(action: string, values: Record<string, unknown> = {}) {
    setWorking(true);
    setNotice("");
    try {
      const payload = (await request("preferences", {
        method: "POST",
        body: JSON.stringify({ action, ...values }),
      })) as ActivityPayload;
      if (payload.preferences) {
        setInbox((current) =>
          current
            ? {
                ...current,
                preferences: payload.preferences,
                ...(action === "mark_read" ? { unreadCount: 0 } : {}),
              }
            : current
        );
        setSummary((current) =>
          current
            ? {
                ...current,
                preferences: payload.preferences,
                ...(action === "mark_read" ? { unreadCount: 0 } : {}),
              }
            : current
        );
      }
      if (action === "mark_read") setNotice("Room activity marked read.");
      if (action === "update_preferences") await loadInbox();
      window.dispatchEvent(new Event("loombus:room-activity-changed"));
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Room preferences could not be updated."
      );
    } finally {
      setWorking(false);
    }
  }

  function openModule(moduleKey: string) {
    const label = isRoomModuleKey(moduleKey)
      ? MODULE_LABELS[moduleKey]
      : undefined;
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "[data-loombus-tier-navigation='true'] button"
      )
    ).find((candidate) => {
      const text = candidate.textContent?.trim() ?? "";
      return Boolean(label && (text === label || text.startsWith(label)));
    });
    button?.click();
    setPanel(null);
  }

  if (!roomId || !host) return null;

  const unreadCount = summary?.unreadCount ?? 0;
  const preferences = inbox?.preferences ?? summary?.preferences;
  const events = inbox?.events ?? [];
  const badge =
    unreadCount > 99 || summary?.unreadCapped ? "99+" : String(unreadCount);

  return createPortal(
    <div className="room-foundation">
      <div className="room-foundation-toolbar">
        <button
          type="button"
          className="room-foundation-search-trigger"
          onClick={() => setPanel(panel === "search" ? null : "search")}
          aria-expanded={panel === "search"}
        >
          <Search aria-hidden="true" />
          <span>Search this Room</span>
        </button>

        <button
          type="button"
          className="room-foundation-inbox-trigger"
          onClick={() => setPanel(panel === "inbox" ? null : "inbox")}
          aria-expanded={panel === "inbox"}
          aria-label={
            unreadCount
              ? `Room inbox, ${unreadCount} unread`
              : "Room inbox, no unread activity"
          }
        >
          {preferences?.muted ? (
            <BellOff aria-hidden="true" />
          ) : (
            <Bell aria-hidden="true" />
          )}
          <span>Room Inbox</span>
          {unreadCount > 0 ? <strong>{badge}</strong> : null}
          {loadingSummary ? <Loader2 className="is-spinning" aria-hidden="true" /> : null}
        </button>
      </div>

      {panel ? (
        <section className="room-foundation-panel">
          <header className="room-foundation-heading">
            <div>
              <p>{summary?.room?.name ?? "Private Room"}</p>
              <h2>{panel === "search" ? "Search this Room" : "Room Inbox"}</h2>
              <span>
                {panel === "search"
                  ? "Find private discussions, dates, announcements, knowledge, files, and operational records."
                  : "Review new Room activity without leaving the private workspace."}
              </span>
            </div>
            <button
              type="button"
              className="room-foundation-close"
              onClick={() => setPanel(null)}
              aria-label="Close Room panel"
            >
              <X aria-hidden="true" />
            </button>
          </header>

          {notice ? <div className="room-foundation-notice">{notice}</div> : null}

          {panel === "search" ? (
            <>
              <form className="room-foundation-search-form" onSubmit={runSearch}>
                <label>
                  <span className="sr-only">Search Room content</span>
                  <Search aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search words, titles, files, tasks, or answers"
                    maxLength={160}
                  />
                </label>
                <select
                  value={moduleFilter}
                  onChange={(event) => setModuleFilter(event.target.value)}
                  aria-label="Filter Room search by module"
                >
                  {SEARCH_MODULES.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={loadingPanel || query.trim().length < 2}
                >
                  {loadingPanel ? (
                    <Loader2 className="is-spinning" aria-hidden="true" />
                  ) : (
                    <Search aria-hidden="true" />
                  )}
                  Search
                </button>
              </form>

              <div className="room-foundation-results">
                {!loadingPanel && searchResults.length === 0 ? (
                  <div className="room-foundation-empty">
                    <Search aria-hidden="true" />
                    <h3>{query.trim() ? "No matching Room content" : "Search the complete Room"}</h3>
                    <p>
                      Results are limited to modules included in this Room plan and
                      sections your role may open.
                    </p>
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={`${result.targetType}-${result.targetId}`}
                      type="button"
                      className="room-foundation-result"
                      onClick={() => openModule(result.moduleKey)}
                    >
                      <span>
                        {result.moduleLabel}
                        {result.createdAt ? ` · ${formatDate(result.createdAt)}` : ""}
                      </span>
                      <strong>{result.title}</strong>
                      {result.snippet ? <p>{result.snippet}</p> : null}
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="room-foundation-inbox-controls">
                <div>
                  <SlidersHorizontal aria-hidden="true" />
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(preferences?.importantOnly)}
                      disabled={working}
                      onChange={(event) =>
                        void postAction("update_preferences", {
                          importantOnly: event.target.checked,
                        })
                      }
                    />
                    <span>Important activity only</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(preferences?.muted)}
                      disabled={working}
                      onChange={(event) =>
                        void postAction("update_preferences", {
                          muted: event.target.checked,
                        })
                      }
                    />
                    <span>Mute unread badge</span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void postAction("mark_read")}
                  disabled={working || unreadCount === 0}
                >
                  {working ? (
                    <Loader2 className="is-spinning" aria-hidden="true" />
                  ) : (
                    <CheckCheck aria-hidden="true" />
                  )}
                  Mark all read
                </button>
              </div>

              <div className="room-foundation-events">
                {loadingPanel ? (
                  <div className="room-foundation-loading">
                    <Loader2 className="is-spinning" aria-hidden="true" />
                    Loading Room activity
                  </div>
                ) : events.length === 0 ? (
                  <div className="room-foundation-empty">
                    <Bell aria-hidden="true" />
                    <h3>No Room activity yet</h3>
                    <p>New discussions, announcements, dates, files, tasks, polls, and membership actions will appear here.</p>
                  </div>
                ) : (
                  events.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`room-foundation-event${
                        item.importance === "high" ? " is-important" : ""
                      }`}
                      onClick={() => openModule(item.moduleKey)}
                    >
                      <span>
                        {item.moduleLabel}
                        {item.createdAt ? ` · ${formatDate(item.createdAt)}` : ""}
                      </span>
                      <strong>{item.title}</strong>
                      {item.summary ? <p>{item.summary}</p> : null}
                      {actorName(item.actor) ? (
                        <small>By {actorName(item.actor)}</small>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>,
    host
  );
}
