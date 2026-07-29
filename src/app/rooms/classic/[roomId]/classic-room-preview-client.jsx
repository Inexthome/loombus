"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  FileText,
  Files,
  Flag,
  ListTodo,
  Loader2,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Vote,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExpansionBody } from "@/components/room-expansion-views";
import { supabase } from "@/lib/supabase/client";

const CORE_SECTIONS = [
  { id: "discussions", label: "Discussions", Icon: MessageSquareText },
  { id: "announcements", label: "Announcements", Icon: FileText },
  { id: "events", label: "Events", Icon: CalendarDays },
  { id: "members", label: "Members", Icon: Users },
];

const STUDIO_SECTIONS = [
  { id: "tasks", label: "Tasks", Icon: ListTodo },
  { id: "polls", label: "Resident Decisions", Icon: Vote },
  { id: "files", label: "Files", Icon: Files },
  { id: "knowledge", label: "Knowledge", Icon: BookOpen },
  { id: "forms", label: "Forms", Icon: ClipboardList },
];

const PAGE_SIZE = 24;

function roleLabel(value) {
  if (value === "owner") return "Owner";
  if (value === "administrator") return "Administrator";
  if (value === "moderator") return "Moderator";
  return "Member";
}

function displayName(profile, fallback = "Room member") {
  return profile?.full_name?.trim() || profile?.username?.trim() || fallback;
}

function formatDate(value) {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date not recorded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function ClassicRoomPreviewClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );

  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [section, setSection] = useState("discussions");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [studioManifest, setStudioManifest] = useState(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioView, setStudioView] = useState("tasks");
  const [studioData, setStudioData] = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioWorking, setStudioWorking] = useState(false);
  const [studioNotice, setStudioNotice] = useState("");
  const [studioNoticeError, setStudioNoticeError] = useState(false);
  const [pageByView, setPageByView] = useState({});

  const [composer, setComposer] = useState(null);
  const [composerWorking, setComposerWorking] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementPriority, setAnnouncementPriority] = useState("normal");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventEndsAt, setEventEndsAt] = useState("");

  const loadWorkspace = useCallback(
    async (isRefresh = false) => {
      if (!roomId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const token = await getAccessToken();
        if (!token) {
          window.location.href = `/login?next=${encodeURIComponent(
            `/rooms/classic/${roomId}`
          )}`;
          return;
        }

        const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));

        if (response.status === 401) {
          window.location.href = `/login?next=${encodeURIComponent(
            `/rooms/classic/${roomId}`
          )}`;
          return;
        }
        if (!response.ok) {
          throw new Error(result.error || "This Room preview could not be opened.");
        }

        setWorkspace(result);

        if (result.access?.allowed) {
          const manifestResponse = await fetch(
            `/api/rooms/${encodeURIComponent(roomId)}/expansion?view=manifest`,
            {
              headers: { Authorization: `Bearer ${token}` },
              cache: "no-store",
            }
          );
          const manifestPayload = await manifestResponse.json().catch(() => ({}));
          if (manifestResponse.ok) {
            setStudioManifest(manifestPayload.data ?? manifestPayload);
          } else {
            setStudioManifest(null);
          }
        }
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "This Room preview could not be opened."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [roomId]
  );

  useEffect(() => {
    void loadWorkspace(false);
  }, [loadWorkspace]);

  useEffect(() => {
    if (!studioOpen && !composer) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (composer) setComposer(null);
      else setStudioOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [composer, studioOpen]);

  const studioRequest = useCallback(
    async (view, init = {}, extra = new URLSearchParams()) => {
      if (!roomId) throw new Error("Room could not be identified.");
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in again before continuing.");
      const query = new URLSearchParams(extra);
      if (view) query.set("view", view);
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/expansion?${query.toString()}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(init.headers ?? {}),
          },
          cache: "no-store",
        }
      );
      if (view === "form_export" && response.ok) return response;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Room Studio could not complete this request.");
      }
      return payload.data ?? payload;
    },
    [roomId]
  );

  const loadStudioView = useCallback(
    async (view, requestedPage = 1) => {
      setStudioLoading(true);
      setStudioNotice("");
      setStudioNoticeError(false);
      try {
        const query = new URLSearchParams();
        if (["tasks", "polls", "forms", "knowledge", "files"].includes(view)) {
          query.set("page", String(Math.max(1, requestedPage)));
          query.set("limit", String(PAGE_SIZE));
        }
        const result = await studioRequest(view, {}, query);
        setStudioData(result);
        if (result?.pageInfo?.page) {
          setPageByView((current) => ({
            ...current,
            [view]: result.pageInfo.page,
          }));
        }
      } catch (cause) {
        setStudioData(null);
        setStudioNotice(
          cause instanceof Error ? cause.message : "Room Studio could not load."
        );
        setStudioNoticeError(true);
      } finally {
        setStudioLoading(false);
      }
    },
    [studioRequest]
  );

  const openStudio = useCallback(
    (view) => {
      setStudioView(view);
      setStudioOpen(true);
      setMobileMenuOpen(false);
      void loadStudioView(view, pageByView[view] ?? 1);
    },
    [loadStudioView, pageByView]
  );

  const studioAction = useCallback(
    async (payload, successMessage, reloadView = studioView) => {
      if (studioWorking) return null;
      setStudioWorking(true);
      setStudioNotice("");
      setStudioNoticeError(false);
      try {
        const result = await studioRequest("", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setStudioNotice(result?.confirmationMessage || successMessage);
        await loadStudioView(reloadView, pageByView[reloadView] ?? 1);
        window.dispatchEvent(new Event("loombus:room-activity-changed"));
        return result;
      } catch (cause) {
        setStudioNotice(
          cause instanceof Error ? cause.message : "Room Studio action failed."
        );
        setStudioNoticeError(true);
        return null;
      } finally {
        setStudioWorking(false);
      }
    },
    [loadStudioView, pageByView, studioRequest, studioView, studioWorking]
  );

  async function submitCoreAction(event) {
    event.preventDefault();
    if (!composer || composerWorking || !roomId) return;
    setComposerWorking(true);
    setNotice("");
    setError("");

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in again before continuing.");
      const body =
        composer === "announcement"
          ? {
              action: "create_announcement",
              title: announcementTitle,
              body: announcementBody,
              priority: announcementPriority,
              isPinned: true,
            }
          : {
              action: "create_event",
              title: eventTitle,
              description: eventDescription,
              location: eventLocation,
              startsAt: eventStartsAt,
              endsAt: eventEndsAt || null,
            };
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "The Room action could not be completed.");
      }
      setNotice(
        composer === "announcement"
          ? "Announcement published."
          : "Event added to the Room calendar."
      );
      setComposer(null);
      setAnnouncementTitle("");
      setAnnouncementBody("");
      setAnnouncementPriority("normal");
      setEventTitle("");
      setEventDescription("");
      setEventLocation("");
      setEventStartsAt("");
      setEventEndsAt("");
      await loadWorkspace(true);
      window.dispatchEvent(new Event("loombus:room-activity-changed"));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The Room action could not be completed."
      );
    } finally {
      setComposerWorking(false);
    }
  }

  function selectSection(nextSection) {
    setSection(nextSection);
    setMobileMenuOpen(false);
  }

  function scrollToNewDiscussion() {
    setSection("discussions");
    setMobileMenuOpen(false);
    window.setTimeout(() => {
      const form = document.querySelector(
        "[data-room-threaded-discussions='true'] form"
      );
      form?.scrollIntoView({ behavior: "smooth", block: "start" });
      form?.querySelector("input")?.focus();
    }, 150);
  }

  if (loading) {
    return (
      <main className="classic-room-state" aria-busy="true" aria-live="polite">
        <Loader2 className="is-spinning" aria-hidden="true" />
        <strong>Opening classic Room preview…</strong>
        <span>The current Room route remains unchanged.</span>
      </main>
    );
  }

  if (error && !workspace) {
    return (
      <main className="classic-room-state is-error">
        <strong>Classic Room preview unavailable</strong>
        <span>{error}</span>
        <Link href="/rooms">Return to Rooms</Link>
      </main>
    );
  }

  if (!workspace?.access?.allowed || !workspace?.room) {
    return (
      <main className="classic-room-state">
        <LockKeyhole aria-hidden="true" />
        <strong>Approved Room access is required</strong>
        <span>
          Use the current Room page to request access. Private content is not exposed
          by this preview.
        </span>
        <Link href={`/rooms/${encodeURIComponent(roomId)}`}>Open current Room page</Link>
      </main>
    );
  }

  const { room, access } = workspace;
  const members = Array.isArray(workspace.members) ? workspace.members : [];
  const announcements = Array.isArray(workspace.announcements)
    ? workspace.announcements
    : [];
  const events = Array.isArray(workspace.events) ? workspace.events : [];
  const canManage = Boolean(access.canManage);
  const studioAvailable = Boolean(studioManifest?.capabilities?.studio);
  const currentRoomUrl = `/rooms/${encodeURIComponent(roomId)}`;

  return (
    <div className="classic-room-preview">
      <button
        type="button"
        className="classic-room-mobile-menu"
        onClick={() => setMobileMenuOpen((current) => !current)}
        aria-expanded={mobileMenuOpen}
        aria-controls="classic-room-sidebar"
      >
        {mobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        <span>{room.name}</span>
      </button>

      {mobileMenuOpen ? (
        <button
          type="button"
          className="classic-room-mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close Room menu"
        />
      ) : null}

      <aside
        id="classic-room-sidebar"
        className={`classic-room-sidebar${mobileMenuOpen ? " is-open" : ""}`}
        aria-label="Classic Room menu"
      >
        <div className="classic-room-brand">
          <span>L</span>
          <strong>Loombus</strong>
        </div>

        <Link href="/rooms" className="classic-room-back-link">
          <ArrowLeft aria-hidden="true" />
          All Rooms
        </Link>

        <section className="classic-room-identity">
          <LockKeyhole aria-hidden="true" />
          <div>
            <strong>{room.name}</strong>
            <span>
              {roleLabel(access.role)} · {room.subscriptionPlan?.replaceAll("_", " ")}
            </span>
          </div>
        </section>

        <nav className="classic-room-nav" aria-label="Room areas">
          <p>Room</p>
          {CORE_SECTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={section === id && !studioOpen ? "page" : undefined}
              onClick={() => selectSection(id)}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
              {id === "members" && members.length ? <small>{members.length}</small> : null}
            </button>
          ))}

          {studioAvailable ? (
            <>
              <p>Workspace</p>
              {STUDIO_SECTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-current={studioOpen && studioView === id ? "page" : undefined}
                  onClick={() => openStudio(id)}
                >
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </>
          ) : null}

          <p>Tools</p>
          <Link href={`${currentRoomUrl}/tools`} target="_blank" rel="noreferrer">
            <Search aria-hidden="true" />
            <span>Search this Room</span>
            <ExternalLink aria-hidden="true" />
          </Link>
          <Link
            href={`${currentRoomUrl}/notifications`}
            target="_blank"
            rel="noreferrer"
          >
            <Bell aria-hidden="true" />
            <span>Notifications</span>
            <ExternalLink aria-hidden="true" />
          </Link>
          <Link
            href={`${currentRoomUrl}/moderation`}
            target="_blank"
            rel="noreferrer"
          >
            <Flag aria-hidden="true" />
            <span>{access.canModerate ? "Moderation" : "Report issue"}</span>
            <ExternalLink aria-hidden="true" />
          </Link>
          {canManage ? (
            <Link
              href={`${currentRoomUrl}/governance`}
              target="_blank"
              rel="noreferrer"
            >
              <ShieldCheck aria-hidden="true" />
              <span>Governance</span>
              <ExternalLink aria-hidden="true" />
            </Link>
          ) : null}
          {access.role === "owner" ? (
            <Link href={`${currentRoomUrl}/billing`} target="_blank" rel="noreferrer">
              <Settings aria-hidden="true" />
              <span>Billing and settings</span>
              <ExternalLink aria-hidden="true" />
            </Link>
          ) : null}
        </nav>

        <p className="classic-room-preview-note">
          Isolated preview. The current Room workspace remains untouched.
        </p>
      </aside>

      <main className="classic-room-main">
        <header className="classic-room-header">
          <div>
            <p>Private Room</p>
            <h1>{room.name}</h1>
          </div>
          <div className="classic-room-header-actions">
            {section === "discussions" ? (
              <button type="button" onClick={scrollToNewDiscussion}>
                <Plus aria-hidden="true" />
                New discussion
              </button>
            ) : section === "announcements" && canManage ? (
              <button type="button" onClick={() => setComposer("announcement")}>
                <Plus aria-hidden="true" />
                New announcement
              </button>
            ) : section === "events" && canManage ? (
              <button type="button" onClick={() => setComposer("event")}>
                <Plus aria-hidden="true" />
                New event
              </button>
            ) : null}
            <button
              type="button"
              className="is-secondary"
              onClick={() => void loadWorkspace(true)}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="is-spinning" aria-hidden="true" /> : null}
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </header>

        {notice ? <div className="classic-room-notice">{notice}</div> : null}
        {error ? <div className="classic-room-notice is-error">{error}</div> : null}

        {section === "discussions" ? (
          <section className="room-workspace-discussions classic-room-discussions">
            <div className="room-workspace-section-heading classic-room-section-heading">
              <div>
                <p>Room conversation</p>
                <h2>Discussions</h2>
              </div>
            </div>
          </section>
        ) : null}

        {section === "announcements" ? (
          <section className="classic-room-section">
            <div className="classic-room-section-heading">
              <div>
                <p>Official updates</p>
                <h2>Announcements</h2>
              </div>
              <span>{announcements.length} total</span>
            </div>
            <div className="classic-room-card-list">
              {announcements.length ? (
                announcements.map((announcement) => (
                  <article key={announcement.id}>
                    <header>
                      <strong>{announcement.title}</strong>
                      <span>{announcement.priority || "normal"}</span>
                    </header>
                    <p>{announcement.body}</p>
                    <small>
                      {displayName(announcement.creator, "Room leadership")} · {formatDate(announcement.createdAt)}
                    </small>
                  </article>
                ))
              ) : (
                <div className="classic-room-empty">
                  <FileText aria-hidden="true" />
                  <strong>No announcements yet</strong>
                  <span>Official Room updates will appear here.</span>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {section === "events" ? (
          <section className="classic-room-section">
            <div className="classic-room-section-heading">
              <div>
                <p>Shared schedule</p>
                <h2>Events</h2>
              </div>
              <span>{events.length} total</span>
            </div>
            <div className="classic-room-card-list">
              {events.length ? (
                events.map((event) => (
                  <article key={event.id}>
                    <header>
                      <strong>{event.title}</strong>
                      <span>{formatDate(event.startsAt)}</span>
                    </header>
                    {event.description ? <p>{event.description}</p> : null}
                    <small>{event.location || "Location not specified"}</small>
                  </article>
                ))
              ) : (
                <div className="classic-room-empty">
                  <CalendarDays aria-hidden="true" />
                  <strong>No events scheduled</strong>
                  <span>Room dates and meetings will appear here.</span>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {section === "members" ? (
          <section className="classic-room-section">
            <div className="classic-room-section-heading">
              <div>
                <p>Private directory</p>
                <h2>Members</h2>
              </div>
              <span>{members.length} active</span>
            </div>
            <div className="classic-room-member-grid">
              {members.map((member) => (
                <article key={member.id || member.userId}>
                  <div className="classic-room-member-avatar">
                    {displayName(member.profile, "M").slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <strong>{displayName(member.profile, member.userId)}</strong>
                    <span>{roleLabel(member.role)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      {composer ? (
        <div className="classic-room-dialog-backdrop" role="presentation">
          <section
            className="classic-room-dialog is-compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="classic-room-composer-title"
          >
            <header>
              <div>
                <p>{room.name}</p>
                <h2 id="classic-room-composer-title">
                  {composer === "announcement" ? "New announcement" : "New event"}
                </h2>
              </div>
              <button type="button" onClick={() => setComposer(null)} aria-label="Close">
                <X aria-hidden="true" />
              </button>
            </header>
            <form onSubmit={submitCoreAction} className="classic-room-dialog-form">
              {composer === "announcement" ? (
                <>
                  <label>
                    <span>Title</span>
                    <input
                      value={announcementTitle}
                      onChange={(event) => setAnnouncementTitle(event.target.value)}
                      required
                      maxLength={200}
                    />
                  </label>
                  <label>
                    <span>Message</span>
                    <textarea
                      value={announcementBody}
                      onChange={(event) => setAnnouncementBody(event.target.value)}
                      required
                      rows={6}
                    />
                  </label>
                  <label>
                    <span>Priority</span>
                    <select
                      value={announcementPriority}
                      onChange={(event) => setAnnouncementPriority(event.target.value)}
                    >
                      <option value="normal">Normal</option>
                      <option value="important">Important</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label>
                    <span>Event title</span>
                    <input
                      value={eventTitle}
                      onChange={(event) => setEventTitle(event.target.value)}
                      required
                      maxLength={200}
                    />
                  </label>
                  <label>
                    <span>Description</span>
                    <textarea
                      value={eventDescription}
                      onChange={(event) => setEventDescription(event.target.value)}
                      rows={4}
                    />
                  </label>
                  <label>
                    <span>Location</span>
                    <input
                      value={eventLocation}
                      onChange={(event) => setEventLocation(event.target.value)}
                    />
                  </label>
                  <div className="classic-room-form-grid">
                    <label>
                      <span>Starts</span>
                      <input
                        type="datetime-local"
                        value={eventStartsAt}
                        onChange={(event) => setEventStartsAt(event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      <span>Ends</span>
                      <input
                        type="datetime-local"
                        value={eventEndsAt}
                        onChange={(event) => setEventEndsAt(event.target.value)}
                      />
                    </label>
                  </div>
                </>
              )}
              <footer>
                <button type="button" className="is-secondary" onClick={() => setComposer(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={composerWorking}>
                  {composerWorking ? <Loader2 className="is-spinning" aria-hidden="true" /> : null}
                  {composerWorking
                    ? "Saving"
                    : composer === "announcement"
                      ? "Publish announcement"
                      : "Add event"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {studioOpen ? (
        <div className="classic-room-dialog-backdrop" role="presentation">
          <section
            className="classic-room-dialog is-studio"
            role="dialog"
            aria-modal="true"
            aria-labelledby="classic-room-studio-title"
          >
            <header>
              <div>
                <p>{room.name}</p>
                <h2 id="classic-room-studio-title">
                  {STUDIO_SECTIONS.find((item) => item.id === studioView)?.label || "Room Studio"}
                </h2>
              </div>
              <button type="button" onClick={() => setStudioOpen(false)} aria-label="Close Room Studio">
                <X aria-hidden="true" />
              </button>
            </header>

            <nav className="classic-room-studio-tabs" aria-label="Room Studio areas">
              {STUDIO_SECTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={studioView === id}
                  onClick={() => {
                    setStudioView(id);
                    void loadStudioView(id, pageByView[id] ?? 1);
                  }}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </button>
              ))}
            </nav>

            {studioNotice ? (
              <div className={`classic-room-notice${studioNoticeError ? " is-error" : ""}`}>
                {studioNotice}
              </div>
            ) : null}

            <div className="classic-room-studio-body">
              {studioLoading ? (
                <div className="classic-room-empty">
                  <Loader2 className="is-spinning" aria-hidden="true" />
                  <strong>Loading Room Studio…</strong>
                </div>
              ) : (
                <ExpansionBody
                  view={studioView}
                  data={studioData}
                  manifest={studioManifest}
                  members={members}
                  working={studioWorking}
                  loading={studioLoading}
                  action={studioAction}
                  request={studioRequest}
                  onPageChange={(page) => void loadStudioView(studioView, page)}
                />
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
