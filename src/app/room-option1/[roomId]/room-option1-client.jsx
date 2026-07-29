"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Check,
  ExternalLink,
  FileText,
  Flag,
  Loader2,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const CORE_TABS = [
  ["overview", "Overview"],
  ["discussions", "Discussions"],
  ["calendar", "Calendar"],
  ["announcements", "Announcements"],
  ["members", "Members"],
];

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

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function RoomOptionOneClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );

  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [section, setSection] = useState("discussions");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moduleOpen, setModuleOpen] = useState(false);
  const [workingKey, setWorkingKey] = useState(null);
  const [composer, setComposer] = useState(null);

  const [accessNote, setAccessNote] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementPriority, setAnnouncementPriority] = useState("normal");
  const [announcementPinned, setAnnouncementPinned] = useState(true);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventEndsAt, setEventEndsAt] = useState("");
  const discussionInitialized = useRef(false);

  const loadWorkspace = useCallback(
    async (isRefresh = false) => {
      if (!roomId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setMessage("");
      setMessageIsError(false);

      try {
        const token = await accessToken();
        if (!token) {
          window.location.href = `/login?next=${encodeURIComponent(
            `/room-option1/${roomId}`
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
            `/room-option1/${roomId}`
          )}`;
          return;
        }
        if (!response.ok) {
          throw new Error(result.error || "This Room could not be opened.");
        }
        setWorkspace(result);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "This Room could not be opened.");
        setMessageIsError(true);
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
    if (!workspace?.access?.allowed || !roomId) return undefined;
    const reload = () => void loadWorkspace(true);
    const channel = supabase
      .channel(`room-option1-core:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_events", filter: `room_id=eq.${roomId}` },
        reload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_announcements", filter: `room_id=eq.${roomId}` },
        reload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        reload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_applications", filter: `room_id=eq.${roomId}` },
        reload
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadWorkspace, roomId, workspace?.access?.allowed]);

  useEffect(() => {
    if (!workspace?.access?.allowed) return undefined;
    let frame = 0;
    const sync = () => {
      frame = 0;
      const shell = document.querySelector(".room-option1-shell");
      setModuleOpen(Boolean(shell?.classList.contains("is-room-tier-module-active")));
      if (discussionInitialized.current) return;
      const discussionButton = Array.from(
        document.querySelectorAll(".room-option1-sidebar .room-tier-navigation button")
      ).find((button) => button.textContent?.trim().startsWith("Discussions"));
      if (discussionButton) {
        discussionInitialized.current = true;
        discussionButton.click();
      }
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };
    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-pressed"],
    });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [workspace?.access?.allowed]);

  useEffect(() => {
    if (!composer && !moduleOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event) => {
      if (event.key !== "Escape") return;
      if (composer) setComposer(null);
      else returnToDiscussions();
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  });

  async function roomAction(action, payload, key, successMessage) {
    if (!roomId || workingKey) return false;
    setWorkingKey(key);
    setMessage("");
    setMessageIsError(false);
    try {
      const token = await accessToken();
      if (!token) throw new Error("Sign in again before continuing.");
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "The Room action could not be completed.");
      }
      setMessage(successMessage);
      await loadWorkspace(true);
      window.dispatchEvent(new Event("loombus:room-activity-changed"));
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The Room action could not be completed."
      );
      setMessageIsError(true);
      return false;
    } finally {
      setWorkingKey(null);
    }
  }

  async function requestAccess(event) {
    event.preventDefault();
    const completed = await roomAction(
      "request_access",
      { note: accessNote },
      "request-access",
      "Access request sent."
    );
    if (completed) setAccessNote("");
  }

  async function submitComposer(event) {
    event.preventDefault();
    if (composer === "announcement") {
      const completed = await roomAction(
        "create_announcement",
        {
          title: announcementTitle,
          body: announcementBody,
          priority: announcementPriority,
          isPinned: announcementPinned,
        },
        "create-announcement",
        "Announcement published."
      );
      if (completed) {
        setAnnouncementTitle("");
        setAnnouncementBody("");
        setAnnouncementPriority("normal");
        setAnnouncementPinned(true);
        setComposer(null);
      }
      return;
    }

    const completed = await roomAction(
      "create_event",
      {
        title: eventTitle,
        description: eventDescription,
        location: eventLocation,
        startsAt: eventStartsAt,
        endsAt: eventEndsAt || null,
      },
      "create-event",
      "Event added to the Room calendar."
    );
    if (completed) {
      setEventTitle("");
      setEventDescription("");
      setEventLocation("");
      setEventStartsAt("");
      setEventEndsAt("");
      setComposer(null);
    }
  }

  function scrollToDiscussionComposer() {
    setSection("discussions");
    setMobileMenuOpen(false);
    window.setTimeout(() => {
      const form = document.querySelector("[data-room-threaded-discussions='true'] form");
      form?.scrollIntoView({ behavior: "smooth", block: "start" });
      form?.querySelector("input")?.focus();
    }, 120);
  }

  function returnToDiscussions() {
    const button = Array.from(
      document.querySelectorAll(".room-option1-sidebar .room-tier-navigation button")
    ).find((candidate) => candidate.textContent?.trim().startsWith("Discussions"));
    button?.click();
    setSection("discussions");
    setModuleOpen(false);
  }

  if (loading) {
    return (
      <main className="room-option1-state" aria-busy="true" aria-live="polite">
        <Loader2 className="is-spinning" aria-hidden="true" />
        <strong>Opening Room…</strong>
        <span>Verifying private access and Room permissions.</span>
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="room-option1-state is-error">
        <strong>Room unavailable</strong>
        <span>{message || "This Room could not be opened."}</span>
        <Link href="/rooms">Return to Rooms</Link>
      </main>
    );
  }

  if (!workspace.access?.allowed || !workspace.room) {
    const application = workspace.application;
    return (
      <main className="room-option1-access">
        <Link href="/rooms" className="room-option1-back">
          <ArrowLeft aria-hidden="true" /> All Rooms
        </Link>
        <section>
          <LockKeyhole aria-hidden="true" />
          <p>Private Room</p>
          <h1>Approved membership is required</h1>
          <span>Room discussions, members, files, and operations remain private.</span>
          {message ? (
            <div className={`room-option1-notice${messageIsError ? " is-error" : ""}`}>
              {message}
            </div>
          ) : null}
          {application ? (
            <div className="room-option1-application-status">
              <UserCheck aria-hidden="true" />
              <div>
                <strong>Request status: {application.state}</strong>
                <span>{formatDate(application.createdAt)}</span>
                {application.note ? <p>{application.note}</p> : null}
              </div>
            </div>
          ) : (
            <form onSubmit={requestAccess}>
              <label>
                <span>Optional note to Room leadership</span>
                <textarea
                  value={accessNote}
                  onChange={(event) => setAccessNote(event.target.value.slice(0, 1000))}
                  rows={4}
                  maxLength={1000}
                />
              </label>
              <button type="submit" disabled={workingKey === "request-access"}>
                {workingKey === "request-access" ? (
                  <Loader2 className="is-spinning" aria-hidden="true" />
                ) : null}
                Send access request
              </button>
            </form>
          )}
        </section>
      </main>
    );
  }

  const { room, access } = workspace;
  const members = (Array.isArray(workspace.members) ? workspace.members : []).filter(
    (member) => !["blocked", "removed", "inactive"].includes(String(member.status).toLowerCase())
  );
  const announcements = Array.isArray(workspace.announcements)
    ? workspace.announcements
    : [];
  const events = Array.isArray(workspace.events) ? workspace.events : [];
  const applications = (Array.isArray(workspace.applications) ? workspace.applications : []).filter(
    (application) => application.state === "pending"
  );
  const isOwner = access.role === "owner";
  const canManage = Boolean(access.canManage);
  const currentRoomBase = `/rooms/${encodeURIComponent(roomId)}`;

  return (
    <div className="rooms-live-page room-option1-page">
      <div className="rooms-live-shell room-option1-shell" data-room-option1="true">
        <button
          type="button"
          className="room-option1-mobile-menu"
          onClick={() => setMobileMenuOpen((current) => !current)}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          <span>{room.name}</span>
        </button>

        {mobileMenuOpen ? (
          <button
            type="button"
            className="room-option1-mobile-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close Room menu"
          />
        ) : null}

        <aside className={`room-option1-sidebar${mobileMenuOpen ? " is-open" : ""}`}>
          <div className="room-option1-brand">
            <span>L</span>
            <strong>Loombus</strong>
          </div>
          <Link href="/rooms" className="room-option1-back">
            <ArrowLeft aria-hidden="true" /> All Rooms
          </Link>
          <section className="room-option1-identity">
            <LockKeyhole aria-hidden="true" />
            <div>
              <strong>{room.name}</strong>
              <span>
                {roleLabel(access.role)} · {String(room.subscriptionPlan || "room").replaceAll("_", " ")}
              </span>
            </div>
          </section>

          <p className="room-option1-menu-label">Room menu</p>
          <nav className="room-workspace-tabs room-option1-original-tabs" aria-label="Room core areas">
            {CORE_TABS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setSection(value === "overview" ? "discussions" : value);
                  setMobileMenuOpen(false);
                }}
              >
                {label}
              </button>
            ))}
          </nav>

          <nav className="room-option1-tools" aria-label="Room tools">
            <p>Tools</p>
            <Link href={`${currentRoomBase}/tools`} target="_blank" rel="noreferrer">
              <Search aria-hidden="true" /> Search this Room <ExternalLink aria-hidden="true" />
            </Link>
            <Link href={`${currentRoomBase}/notifications`} target="_blank" rel="noreferrer">
              <Bell aria-hidden="true" /> Notifications <ExternalLink aria-hidden="true" />
            </Link>
            <Link href={`${currentRoomBase}/moderation`} target="_blank" rel="noreferrer">
              <Flag aria-hidden="true" /> {access.canModerate ? "Moderation" : "Report issue"}
              <ExternalLink aria-hidden="true" />
            </Link>
            {canManage ? (
              <Link href={`${currentRoomBase}/governance`} target="_blank" rel="noreferrer">
                <ShieldCheck aria-hidden="true" /> Governance <ExternalLink aria-hidden="true" />
              </Link>
            ) : null}
            {isOwner ? (
              <Link href={`${currentRoomBase}/billing`} target="_blank" rel="noreferrer">
                <Settings aria-hidden="true" /> Billing <ExternalLink aria-hidden="true" />
              </Link>
            ) : null}
          </nav>
        </aside>

        <main className="room-option1-main">
          <header className="room-option1-header">
            <h1>{room.name}</h1>
            <div>
              {section === "discussions" ? (
                <button type="button" onClick={scrollToDiscussionComposer}>
                  <Plus aria-hidden="true" /> New discussion
                </button>
              ) : section === "announcements" && canManage ? (
                <button type="button" onClick={() => setComposer("announcement")}>
                  <Plus aria-hidden="true" /> New announcement
                </button>
              ) : section === "calendar" && canManage ? (
                <button type="button" onClick={() => setComposer("event")}>
                  <Plus aria-hidden="true" /> New event
                </button>
              ) : null}
              <button
                type="button"
                className="is-secondary"
                onClick={() => void loadWorkspace(true)}
                disabled={refreshing}
              >
                <RefreshCw className={refreshing ? "is-spinning" : undefined} aria-hidden="true" />
                Refresh
              </button>
            </div>
          </header>

          {message ? (
            <div className={`room-option1-notice${messageIsError ? " is-error" : ""}`}>
              {message}
            </div>
          ) : null}

          {section === "discussions" ? (
            <section className="room-workspace-discussions room-option1-discussions">
              <div className="room-workspace-section-heading room-option1-section-heading">
                <div>
                  <p>Room conversation</p>
                  <h2>Discussions</h2>
                </div>
              </div>
            </section>
          ) : null}

          {section === "announcements" ? (
            <section className="room-option1-section">
              <div className="room-option1-section-heading">
                <div>
                  <p>Official updates</p>
                  <h2>Announcements</h2>
                </div>
                <span>{announcements.length} total</span>
              </div>
              <div className="room-option1-list">
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
                  <div className="room-option1-empty">
                    <FileText aria-hidden="true" />
                    <strong>No announcements yet</strong>
                    <span>Official Room updates will appear here.</span>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {section === "calendar" ? (
            <section className="room-option1-section">
              <div className="room-option1-section-heading">
                <div>
                  <p>Shared schedule</p>
                  <h2>Calendar</h2>
                </div>
                <Link href={`${currentRoomBase}/calendar`} target="_blank" rel="noreferrer">
                  Open full calendar <ExternalLink aria-hidden="true" />
                </Link>
              </div>
              <div className="room-option1-list">
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
                  <div className="room-option1-empty">
                    <CalendarDays aria-hidden="true" />
                    <strong>No events scheduled</strong>
                    <span>Room dates and meetings will appear here.</span>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {section === "members" ? (
            <section className="room-option1-section">
              <div className="room-option1-section-heading">
                <div>
                  <p>Private directory and access</p>
                  <h2>Members</h2>
                </div>
                <span>{members.length} active</span>
              </div>

              {canManage && applications.length ? (
                <div className="room-option1-applications">
                  <h3>Pending access requests</h3>
                  {applications.map((application) => (
                    <article key={application.id}>
                      <div>
                        <strong>{displayName(application.applicant, application.applicantId)}</strong>
                        <span>{formatDate(application.createdAt)}</span>
                        {application.note ? <p>{application.note}</p> : null}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            void roomAction(
                              "review_application",
                              { applicationId: application.id, state: "approved" },
                              `approve:${application.id}`,
                              "Access request approved."
                            )
                          }
                          disabled={Boolean(workingKey)}
                        >
                          <Check aria-hidden="true" /> Approve
                        </button>
                        <button
                          type="button"
                          className="is-secondary"
                          onClick={() =>
                            void roomAction(
                              "review_application",
                              { applicationId: application.id, state: "declined" },
                              `decline:${application.id}`,
                              "Access request declined."
                            )
                          }
                          disabled={Boolean(workingKey)}
                        >
                          Decline
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              <div className="room-option1-members">
                {members.map((member) => {
                  const memberIsOwner = member.role === "owner";
                  const canEditMember =
                    canManage &&
                    !memberIsOwner &&
                    !(access.role === "administrator" && member.role === "administrator");
                  return (
                    <article key={member.id || member.userId}>
                      <div className="room-option1-avatar">
                        {displayName(member.profile, "M").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="room-option1-member-copy">
                        <strong>{displayName(member.profile, member.userId)}</strong>
                        <span>{roleLabel(member.role)}</span>
                      </div>
                      {canEditMember ? (
                        <div className="room-option1-member-actions">
                          <select
                            value={member.role}
                            onChange={(event) =>
                              void roomAction(
                                "update_member_role",
                                { memberId: member.id, role: event.target.value },
                                `role:${member.id}`,
                                "Member role updated."
                              )
                            }
                            disabled={Boolean(workingKey)}
                            aria-label={`Role for ${displayName(member.profile, member.userId)}`}
                          >
                            {isOwner ? <option value="administrator">Administrator</option> : null}
                            <option value="moderator">Moderator</option>
                            <option value="member">Member</option>
                          </select>
                          <button
                            type="button"
                            className="is-danger"
                            onClick={() => {
                              const confirmed = window.confirm(
                                `Remove ${displayName(member.profile, member.userId)} from this Room?`
                              );
                              if (!confirmed) return;
                              void roomAction(
                                "remove_member",
                                { memberId: member.id },
                                `remove:${member.id}`,
                                "Member removed."
                              );
                            }}
                            disabled={Boolean(workingKey)}
                            aria-label={`Remove ${displayName(member.profile, member.userId)}`}
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </main>

        {moduleOpen ? (
          <button type="button" className="room-option1-module-close" onClick={returnToDiscussions}>
            <X aria-hidden="true" /> Back to discussions
          </button>
        ) : null}
      </div>

      {composer ? (
        <div className="room-option1-dialog-backdrop" role="presentation">
          <section className="room-option1-dialog" role="dialog" aria-modal="true">
            <header>
              <div>
                <p>{room.name}</p>
                <h2>{composer === "announcement" ? "New announcement" : "New event"}</h2>
              </div>
              <button type="button" onClick={() => setComposer(null)} aria-label="Close">
                <X aria-hidden="true" />
              </button>
            </header>
            <form onSubmit={submitComposer}>
              {composer === "announcement" ? (
                <>
                  <label>
                    <span>Title</span>
                    <input
                      value={announcementTitle}
                      onChange={(event) => setAnnouncementTitle(event.target.value.slice(0, 160))}
                      required
                      minLength={1}
                      maxLength={160}
                    />
                  </label>
                  <label>
                    <span>Message</span>
                    <textarea
                      value={announcementBody}
                      onChange={(event) => setAnnouncementBody(event.target.value.slice(0, 5000))}
                      rows={6}
                      required
                      maxLength={5000}
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
                  <label className="room-option1-checkbox">
                    <input
                      type="checkbox"
                      checked={announcementPinned}
                      onChange={(event) => setAnnouncementPinned(event.target.checked)}
                    />
                    <span>Pin this announcement</span>
                  </label>
                </>
              ) : (
                <>
                  <label>
                    <span>Event title</span>
                    <input
                      value={eventTitle}
                      onChange={(event) => setEventTitle(event.target.value.slice(0, 180))}
                      required
                      minLength={1}
                      maxLength={180}
                    />
                  </label>
                  <label>
                    <span>Description</span>
                    <textarea
                      value={eventDescription}
                      onChange={(event) => setEventDescription(event.target.value.slice(0, 3000))}
                      rows={4}
                      maxLength={3000}
                    />
                  </label>
                  <label>
                    <span>Location</span>
                    <input
                      value={eventLocation}
                      onChange={(event) => setEventLocation(event.target.value.slice(0, 300))}
                      maxLength={300}
                    />
                  </label>
                  <div className="room-option1-form-grid">
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
                <button type="submit" disabled={Boolean(workingKey)}>
                  {workingKey ? <Loader2 className="is-spinning" aria-hidden="true" /> : null}
                  {composer === "announcement" ? "Publish announcement" : "Add event"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
