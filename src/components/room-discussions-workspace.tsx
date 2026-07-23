"use client";

import { createPortal } from "react-dom";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Eye,
  Loader2,
  MessageCircle,
  MessageSquareText,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Send,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useParams } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ProfileAvatar,
  getProfileDisplayName,
} from "@/components/profile-avatar";
import {
  DISCUSSION_MODE_DEFINITIONS,
  DISCUSSION_MODE_KEYS,
  type DiscussionMetadata,
  type DiscussionMode,
} from "@/lib/discussion-modes";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  account_status: string | null;
};

type RoomReply = {
  id: string;
  authorId: string;
  author: Profile | null;
  body: string;
  createdAt: string | null;
  updatedAt: string | null;
  canDelete: boolean;
};

type RoomThread = {
  id: string;
  roomId: string;
  authorId: string;
  author: Profile | null;
  title: string;
  body: string;
  discussionType: DiscussionMode;
  discussionMetadata: DiscussionMetadata;
  status: "open" | "resolved";
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolver: Profile | null;
  lastActivityAt: string | null;
  replyCount: number;
  lastReadAt: string | null;
  isUnread: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  canResolve: boolean;
  canDelete: boolean;
  replies: RoomReply[];
};

type ThreadResponse = {
  room?: { id: string; name: string };
  permissions?: {
    currentUserId: string;
    canPost: boolean;
    canReply: boolean;
    canManage: boolean;
    canModerate: boolean;
    memberPostsAllowed: boolean;
  };
  posts?: RoomThread[];
  error?: string;
};

type PortalTarget = {
  section: HTMLElement;
  host: HTMLElement;
};

type FilterKey = "all" | "unread" | "resolved";

const MODE_ICONS: Record<DiscussionMode, LucideIcon> = {
  open_discussion: MessageSquareText,
  debate: Scale,
  research_question: Search,
  problem_solving: Puzzle,
};

function ensurePortalTarget(): PortalTarget | null {
  const section = document.querySelector<HTMLElement>(
    "section.room-workspace-discussions"
  );
  if (!section) return null;

  let host = section.querySelector<HTMLElement>(
    "[data-room-threaded-discussions-host='true']"
  );
  if (!host) {
    host = document.createElement("div");
    host.dataset.roomThreadedDiscussionsHost = "true";
    section.appendChild(host);
  }

  const heading = section.querySelector<HTMLElement>(
    ".room-workspace-section-heading"
  );
  for (const child of Array.from(section.children)) {
    if (child === heading || child === host) continue;
    (child as HTMLElement).hidden = true;
  }

  return { section, host };
}

function restoreLegacyDiscussionPanel() {
  const section = document.querySelector<HTMLElement>(
    "section.room-workspace-discussions"
  );
  if (!section) return;
  const host = section.querySelector<HTMLElement>(
    "[data-room-threaded-discussions-host='true']"
  );
  for (const child of Array.from(section.children)) {
    if (child !== host) (child as HTMLElement).hidden = false;
  }
  host?.remove();
}

function formatRelativeTime(value: string | null) {
  if (!value) return "No activity recorded";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "No activity recorded";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function metadataEntries(thread: RoomThread) {
  const definition = DISCUSSION_MODE_DEFINITIONS[thread.discussionType];
  return definition.fields
    .map((field) => ({
      label: field.label,
      value: thread.discussionMetadata[field.key] ?? "",
    }))
    .filter((entry) => entry.value);
}

export function RoomDiscussionsWorkspace() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [portal, setPortal] = useState<PortalTarget | null>(null);
  const [data, setData] = useState<ThreadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<DiscussionMode>("open_discussion");
  const [metadata, setMetadata] = useState<DiscussionMetadata>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    let scheduled = false;
    const scan = () => {
      scheduled = false;
      const next = ensurePortalTarget();
      setPortal((current) => {
        if (!next) return null;
        if (current?.section === next.section && current.host === next.host) {
          return current;
        }
        return next;
      });
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
      restoreLegacyDiscussionPanel();
    };
  }, []);

  const loadThreads = useCallback(
    async (isRefresh = false) => {
      if (!roomId || !portal) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setMessage("");
      setMessageIsError(false);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Sign in again before opening Room discussions.");
        const response = await fetch(
          `/api/rooms/${encodeURIComponent(roomId)}/discussions`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }
        );
        const result = (await response.json().catch(() => ({}))) as ThreadResponse;
        if (!response.ok) {
          throw new Error(result.error ?? "Room discussions could not be loaded.");
        }
        setData(result);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Room discussions could not be loaded."
        );
        setMessageIsError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [portal, roomId]
  );

  useEffect(() => {
    void loadThreads(false);
  }, [loadThreads]);

  useEffect(() => {
    if (!portal || !roomId) return;
    const reload = () => void loadThreads(true);
    const channel = supabase
      .channel(`room-threaded-discussions:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_posts",
          filter: `room_id=eq.${roomId}`,
        },
        reload
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_post_replies",
          filter: `room_id=eq.${roomId}`,
        },
        reload
      )
      .subscribe();
    const fallback = window.setInterval(reload, 30_000);
    return () => {
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [loadThreads, portal, roomId]);

  async function performAction(
    action: string,
    payload: Record<string, unknown>,
    key: string,
    successMessage?: string,
    reload = true
  ) {
    if (!roomId || workingKey) return false;
    setWorkingKey(key);
    setMessage("");
    setMessageIsError(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before continuing.");
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/discussions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, ...payload }),
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? "The Room discussion action failed.");
      }
      if (successMessage) setMessage(successMessage);
      if (reload) await loadThreads(true);
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The Room discussion action failed."
      );
      setMessageIsError(true);
      return false;
    } finally {
      setWorkingKey(null);
    }
  }

  async function createThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const completed = await performAction(
      "create_post",
      {
        title,
        body,
        discussionType: mode,
        discussionMetadata: metadata,
      },
      "create-post",
      "Room discussion created."
    );
    if (completed) {
      setTitle("");
      setBody("");
      setMode("open_discussion");
      setMetadata({});
      setFilter("all");
    }
  }

  async function createReply(
    event: FormEvent<HTMLFormElement>,
    postId: string
  ) {
    event.preventDefault();
    const replyBody = replyDrafts[postId] ?? "";
    const completed = await performAction(
      "create_reply",
      { postId, body: replyBody },
      `reply:${postId}`,
      "Reply posted."
    );
    if (completed) {
      setReplyDrafts((current) => ({ ...current, [postId]: "" }));
      setExpandedPostId(postId);
    }
  }

  async function markRead(postId: string) {
    setData((current) =>
      current
        ? {
            ...current,
            posts: current.posts?.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    isUnread: false,
                    lastReadAt: new Date().toISOString(),
                  }
                : post
            ),
          }
        : current
    );
    await performAction("mark_read", { postId }, `read:${postId}`, undefined, false);
  }

  function toggleThread(thread: RoomThread) {
    const opening = expandedPostId !== thread.id;
    setExpandedPostId(opening ? thread.id : null);
    if (opening && thread.isUnread) void markRead(thread.id);
  }

  const posts = data?.posts ?? [];
  const unreadCount = posts.filter((post) => post.isUnread).length;
  const filteredPosts = posts.filter((post) => {
    if (filter === "unread") return post.isUnread;
    if (filter === "resolved") return post.status === "resolved";
    return true;
  });
  const selectedMode = DISCUSSION_MODE_DEFINITIONS[mode];

  if (!portal) return null;

  return createPortal(
    <div className="mt-5 space-y-5" data-room-threaded-discussions="true">
      {message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
            messageIsError
              ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
          }`}
        >
          {message}
        </div>
      ) : null}

      {data?.permissions?.canPost ? (
        <form
          onSubmit={createThread}
          className="space-y-4 rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a701c] dark:text-[#d6a84f]">
                New Room discussion
              </p>
              <h3 className="mt-1 text-lg font-black text-[var(--loombus-text)]">
                Choose the structure the conversation needs
              </h3>
            </div>
            <span className="text-xs font-bold text-[var(--loombus-text-subtle)]">
              Private to verified Room members
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            {DISCUSSION_MODE_KEYS.map((modeKey) => {
              const definition = DISCUSSION_MODE_DEFINITIONS[modeKey];
              const Icon = MODE_ICONS[modeKey];
              const active = mode === modeKey;
              return (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() => {
                    setMode(modeKey);
                    setMetadata({});
                  }}
                  className={`rounded-2xl border p-3 text-left transition ${
                    active
                      ? "border-amber-400 bg-amber-50 text-zinc-950 ring-2 ring-amber-200/70 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-500/20"
                      : "border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] text-[var(--loombus-text-muted)] hover:border-amber-300"
                  }`}
                >
                  <Icon className="mb-2 size-4" aria-hidden="true" />
                  <strong className="block text-sm">{definition.label}</strong>
                  <span className="mt-1 block text-xs leading-5 opacity-80">
                    {definition.description}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-[var(--loombus-text)]">
              Title
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, 160))}
              minLength={4}
              maxLength={160}
              required
              placeholder="Give the Room discussion a clear title"
              className="min-h-12 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 text-sm text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20"
            />
          </label>

          {selectedMode.fields.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedMode.fields.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-2 block text-sm font-black text-[var(--loombus-text)]">
                    {field.label}
                    {field.required ? " *" : ""}
                  </span>
                  {field.multiline ? (
                    <textarea
                      value={metadata[field.key] ?? ""}
                      onChange={(event) =>
                        setMetadata((current) => ({
                          ...current,
                          [field.key]: event.target.value.slice(0, field.maxLength),
                        }))
                      }
                      rows={3}
                      maxLength={field.maxLength}
                      required={field.required}
                      placeholder={field.placeholder}
                      className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 text-sm leading-6 text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20"
                    />
                  ) : (
                    <input
                      value={metadata[field.key] ?? ""}
                      onChange={(event) =>
                        setMetadata((current) => ({
                          ...current,
                          [field.key]: event.target.value.slice(0, field.maxLength),
                        }))
                      }
                      maxLength={field.maxLength}
                      required={field.required}
                      placeholder={field.placeholder}
                      className="min-h-12 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 text-sm text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20"
                    />
                  )}
                </label>
              ))}
            </div>
          ) : null}

          <label className="block">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-black text-[var(--loombus-text)]">
                Discussion body
              </span>
              <span className="text-xs font-bold text-[var(--loombus-text-subtle)]">
                {body.length}/5000
              </span>
            </div>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value.slice(0, 5000))}
              rows={5}
              maxLength={5000}
              required
              placeholder={selectedMode.bodyPlaceholder}
              className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 text-sm leading-6 text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={
                workingKey === "create-post" ||
                title.trim().length < 4 ||
                !body.trim()
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#d6a84f] px-5 text-sm font-black text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {workingKey === "create-post" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              Start discussion
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 text-sm text-[var(--loombus-text-muted)]">
          Room leadership has limited new discussions and replies to moderators.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", `All · ${posts.length}`],
              ["unread", `Unread · ${unreadCount}`],
              [
                "resolved",
                `Resolved · ${posts.filter((post) => post.status === "resolved").length}`,
              ],
            ] as Array<[FilterKey, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-full border px-4 py-2 text-xs font-black transition ${
                filter === value
                  ? "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200"
                  : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void loadThreads(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 self-start rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-xs font-black text-[var(--loombus-text-muted)] sm:self-auto"
        >
          <RefreshCw
            className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-3 rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-sm font-bold text-[var(--loombus-text-muted)]">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          Loading Room discussions…
        </div>
      ) : filteredPosts.length > 0 ? (
        <div className="space-y-3">
          {filteredPosts.map((thread) => {
            const definition = DISCUSSION_MODE_DEFINITIONS[thread.discussionType];
            const Icon = MODE_ICONS[thread.discussionType];
            const expanded = expandedPostId === thread.id;
            const entries = metadataEntries(thread);
            return (
              <article
                key={thread.id}
                className={`overflow-hidden rounded-[1.75rem] border bg-[var(--loombus-surface)] shadow-sm transition ${
                  thread.isUnread
                    ? "border-amber-400 ring-2 ring-amber-200/40 dark:ring-amber-500/10"
                    : "border-[var(--loombus-border)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleThread(thread)}
                  className="w-full p-4 text-left sm:p-5"
                  aria-expanded={expanded}
                >
                  <div className="flex items-start gap-3">
                    <ProfileAvatar profile={thread.author} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--loombus-text-subtle)]">
                        <span className="text-[var(--loombus-text)]">
                          {getProfileDisplayName(thread.author)}
                        </span>
                        <span>·</span>
                        <span>{formatRelativeTime(thread.lastActivityAt)}</span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-2 py-1">
                          <Icon className="size-3" aria-hidden="true" />
                          {definition.shortLabel}
                        </span>
                        {thread.status === "resolved" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                            <CheckCircle2 className="size-3" aria-hidden="true" />
                            Resolved
                          </span>
                        ) : null}
                        {thread.isUnread ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
                            <Eye className="size-3" aria-hidden="true" />
                            Unread
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 text-base font-black text-[var(--loombus-text)] sm:text-lg">
                        {thread.title || "Untitled discussion"}
                      </h3>
                      {!expanded ? (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                          {thread.body}
                        </p>
                      ) : null}
                      <div className="mt-3 flex items-center gap-3 text-xs font-bold text-[var(--loombus-text-subtle)]">
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="size-4" aria-hidden="true" />
                          {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}
                        </span>
                        <span>
                          Started {formatRelativeTime(thread.createdAt)}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={`mt-1 size-5 shrink-0 text-[var(--loombus-text-subtle)] transition ${
                        expanded ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                </button>

                {expanded ? (
                  <div className="border-t border-[var(--loombus-border)] px-4 pb-5 pt-4 sm:px-5">
                    {entries.length > 0 ? (
                      <dl className="mb-4 grid gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 sm:grid-cols-2">
                        {entries.map((entry) => (
                          <div key={entry.label}>
                            <dt className="text-xs font-black uppercase tracking-[0.1em] text-[#9a701c] dark:text-[#d6a84f]">
                              {entry.label}
                            </dt>
                            <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text)]">
                              {entry.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}

                    <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text)]">
                      {thread.body}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {thread.canResolve ? (
                        <button
                          type="button"
                          onClick={() =>
                            void performAction(
                              thread.status === "resolved"
                                ? "reopen_post"
                                : "resolve_post",
                              { postId: thread.id },
                              `status:${thread.id}`,
                              thread.status === "resolved"
                                ? "Discussion reopened."
                                : "Discussion resolved."
                            )
                          }
                          disabled={workingKey === `status:${thread.id}`}
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs font-black text-[var(--loombus-text-muted)]"
                        >
                          {thread.status === "resolved" ? (
                            <RotateCcw className="size-4" aria-hidden="true" />
                          ) : (
                            <Circle className="size-4" aria-hidden="true" />
                          )}
                          {thread.status === "resolved" ? "Reopen" : "Mark resolved"}
                        </button>
                      ) : null}
                      {thread.canDelete ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm("Remove this Room discussion?")) return;
                            void performAction(
                              "delete_post",
                              { postId: thread.id },
                              `delete-post:${thread.id}`,
                              "Discussion removed."
                            );
                          }}
                          disabled={workingKey === `delete-post:${thread.id}`}
                          className="inline-flex items-center gap-2 rounded-full border border-red-200 px-3 py-2 text-xs font-black text-red-700 dark:border-red-900/60 dark:text-red-300"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-5 space-y-3 border-t border-[var(--loombus-border)] pt-5">
                      {thread.replies.length > 0 ? (
                        thread.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="flex gap-3 rounded-2xl bg-[var(--loombus-page-bg)] p-3 sm:p-4"
                          >
                            <ProfileAvatar profile={reply.author} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--loombus-text-subtle)]">
                                <strong className="text-[var(--loombus-text)]">
                                  {getProfileDisplayName(reply.author)}
                                </strong>
                                <span>{formatRelativeTime(reply.createdAt)}</span>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text)]">
                                {reply.body}
                              </p>
                            </div>
                            {reply.canDelete ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!window.confirm("Remove this reply?")) return;
                                  void performAction(
                                    "delete_reply",
                                    { replyId: reply.id },
                                    `delete-reply:${reply.id}`,
                                    "Reply removed."
                                  );
                                }}
                                disabled={workingKey === `delete-reply:${reply.id}`}
                                className="grid size-9 shrink-0 place-items-center rounded-full text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
                                aria-label="Remove reply"
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </button>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-[var(--loombus-text-muted)]">
                          No replies yet. Add the first thoughtful response.
                        </p>
                      )}

                      {data?.permissions?.canReply && thread.status === "open" ? (
                        <form
                          onSubmit={(event) => createReply(event, thread.id)}
                          className="flex flex-col gap-3 sm:flex-row sm:items-end"
                        >
                          <label className="min-w-0 flex-1">
                            <span className="sr-only">Reply</span>
                            <textarea
                              value={replyDrafts[thread.id] ?? ""}
                              onChange={(event) =>
                                setReplyDrafts((current) => ({
                                  ...current,
                                  [thread.id]: event.target.value.slice(0, 3000),
                                }))
                              }
                              rows={3}
                              maxLength={3000}
                              required
                              placeholder="Write a focused reply"
                              className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm leading-6 text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20"
                            />
                          </label>
                          <button
                            type="submit"
                            disabled={
                              !(replyDrafts[thread.id] ?? "").trim() ||
                              workingKey === `reply:${thread.id}`
                            }
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#d6a84f] px-5 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {workingKey === `reply:${thread.id}` ? (
                              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <Send className="size-4" aria-hidden="true" />
                            )}
                            Reply
                          </button>
                        </form>
                      ) : thread.status === "resolved" ? (
                        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                          This discussion is resolved. Reopen it before adding replies.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-5 py-12 text-center">
          <MessageSquareText className="mx-auto size-8 text-[var(--loombus-text-subtle)]" />
          <h3 className="mt-3 font-black text-[var(--loombus-text)]">
            {filter === "all"
              ? "No Room discussions yet"
              : `No ${filter} discussions`}
          </h3>
          <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
            {filter === "all"
              ? "Start a focused thread that stays inside this Room."
              : "Choose All to view the complete Room discussion history."}
          </p>
        </div>
      )}
    </div>,
    portal.host
  );
}
