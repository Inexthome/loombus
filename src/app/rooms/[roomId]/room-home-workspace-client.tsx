"use client";

import {
  CalendarDays,
  Check,
  Clock3,
  FileText,
  Loader2,
  LockKeyhole,
  MapPin,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Users,
  Wifi,
  WifiOff,
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
import { RoomDiscussionsDirect } from "@/components/room-discussions-direct";
import {
  ProfileAvatar,
  getProfileDisplayName,
} from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

type RoomRole = "owner" | "administrator" | "moderator" | "member";
type RoomTab = "discussions" | "announcements" | "events" | "members";

type ProfileContext = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  account_status: string | null;
};

type LiveRoom = {
  id: string;
  name: string;
  description: string;
  roomType: string;
  visibility: string;
  inviteOnly: boolean;
  status: string;
  ownerId: string;
  createdBy: string;
  templateKey: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  memberLimit: number | null;
  memberCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

type RoomEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  createdBy: string;
  createdAt: string | null;
  creator: ProfileContext | null;
};

type RoomAnnouncement = {
  id: string;
  title: string;
  body: string;
  priority: string;
  isPinned: boolean;
  createdBy: string;
  createdAt: string | null;
  creator: ProfileContext | null;
};

type RoomMember = {
  id: string;
  userId: string;
  role: RoomRole;
  status: string;
  joinedAt: string | null;
  profile: ProfileContext | null;
};

type RoomApplication = {
  id: string;
  applicantId: string;
  state: string;
  note: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  applicant: ProfileContext | null;
};

type OwnApplication = {
  id: string;
  state: string;
  note: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type WorkspaceResponse = {
  generatedAt?: string;
  currentUserId?: string;
  access?: {
    allowed: boolean;
    role: RoomRole | null;
    canManage: boolean;
    canModerate: boolean;
  };
  room?: LiveRoom | null;
  events?: RoomEvent[];
  announcements?: RoomAnnouncement[];
  members?: RoomMember[];
  applications?: RoomApplication[];
  application?: OwnApplication | null;
  error?: string;
};

const TABS: Array<{
  value: RoomTab;
  label: string;
  Icon: LucideIcon;
}> = [
  { value: "discussions", label: "Discussions", Icon: MessageSquareText },
  { value: "announcements", label: "Announcements", Icon: Megaphone },
  { value: "events", label: "Events", Icon: CalendarDays },
  { value: "members", label: "Members", Icon: Users },
];

const MEMBER_ROLES: Array<{ value: Exclude<RoomRole, "owner">; label: string }> = [
  { value: "administrator", label: "Administrator" },
  { value: "moderator", label: "Moderator" },
  { value: "member", label: "Member" },
];

function roleLabel(role: RoomRole | null | undefined) {
  if (role === "owner") return "Owner";
  if (role === "administrator") return "Administrator";
  if (role === "moderator") return "Moderator";
  return "Member";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "No timestamp";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "No timestamp";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateTime(value);
}

function formatEventRange(event: RoomEvent) {
  if (!event.endsAt) return formatDateTime(event.startsAt);
  return `${formatDateTime(event.startsAt)} to ${formatDateTime(event.endsAt)}`;
}

function priorityClass(priority: string) {
  if (priority === "urgent") return "is-urgent";
  if (priority === "important") return "is-important";
  return "is-normal";
}

export default function RoomHomeWorkspaceClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [activeTab, setActiveTab] = useState<RoomTab>("discussions");
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [announcements, setAnnouncements] = useState<RoomAnnouncement[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [applications, setApplications] = useState<RoomApplication[]>([]);
  const [ownApplication, setOwnApplication] = useState<OwnApplication | null>(null);
  const [access, setAccess] = useState<WorkspaceResponse["access"]>(undefined);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [accessNote, setAccessNote] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventEndsAt, setEventEndsAt] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementPriority, setAnnouncementPriority] = useState("normal");
  const [announcementPinned, setAnnouncementPinned] = useState(true);

  const loadWorkspace = useCallback(
    async (isRefresh = false) => {
      if (!roomId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setMessage("");
      setMessageIsError(false);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          window.location.href = `/login?next=${encodeURIComponent(`/rooms/${roomId}`)}`;
          return;
        }
        const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const result = (await response.json().catch(() => ({}))) as WorkspaceResponse;
        if (response.status === 401) {
          window.location.href = `/login?next=${encodeURIComponent(`/rooms/${roomId}`)}`;
          return;
        }
        if (!response.ok) {
          throw new Error(result.error ?? "Unable to open this Room.");
        }
        setAccess(result.access);
        setRoom(result.room ?? null);
        setEvents(Array.isArray(result.events) ? result.events : []);
        setAnnouncements(
          Array.isArray(result.announcements) ? result.announcements : []
        );
        setMembers(Array.isArray(result.members) ? result.members : []);
        setApplications(
          Array.isArray(result.applications) ? result.applications : []
        );
        setOwnApplication(result.application ?? null);
        setGeneratedAt(result.generatedAt ?? null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to open this Room.");
        setMessageIsError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [roomId]
  );

  useEffect(() => {
    setActiveTab("discussions");
    void loadWorkspace(false);
  }, [loadWorkspace]);

  useEffect(() => {
    if (!roomId || !access?.allowed) return;
    const reload = () => void loadWorkspace(true);
    const channel = supabase
      .channel(`room-home:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_events",
          filter: `room_id=eq.${roomId}`,
        },
        reload
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_announcements",
          filter: `room_id=eq.${roomId}`,
        },
        reload
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${roomId}`,
        },
        reload
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_applications",
          filter: `room_id=eq.${roomId}`,
        },
        reload
      )
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));
    const fallback = window.setInterval(reload, 30_000);
    return () => {
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [access?.allowed, loadWorkspace, roomId]);

  async function submitAction(
    action: string,
    payload: Record<string, unknown>,
    workingId: string,
    successMessage: string
  ) {
    if (!roomId || workingKey) return false;
    setWorkingKey(workingId);
    setMessage("");
    setMessageIsError(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        window.location.href = `/login?next=${encodeURIComponent(`/rooms/${roomId}`)}`;
        return false;
      }
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "The Room action could not be completed.");
      }
      setMessage(successMessage);
      await loadWorkspace(true);
      window.dispatchEvent(new Event("loombus:room-activity-changed"));
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The Room action could not be completed."
      );
      setMessageIsError(true);
      return false;
    } finally {
      setWorkingKey(null);
    }
  }

  async function requestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const completed = await submitAction(
      "request_access",
      { note: accessNote },
      "request-access",
      "Access request sent to the Room owner."
    );
    if (completed) setAccessNote("");
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const completed = await submitAction(
      "create_event",
      {
        title: eventTitle,
        description: eventDescription,
        location: eventLocation,
        startsAt: eventStartsAt,
        endsAt: eventEndsAt,
      },
      "create-event",
      "Room event added."
    );
    if (completed) {
      setEventTitle("");
      setEventDescription("");
      setEventLocation("");
      setEventStartsAt("");
      setEventEndsAt("");
    }
  }

  async function createAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const completed = await submitAction(
      "create_announcement",
      {
        title: announcementTitle,
        body: announcementBody,
        priority: announcementPriority,
        isPinned: announcementPinned,
      },
      "create-announcement",
      "Room announcement published."
    );
    if (completed) {
      setAnnouncementTitle("");
      setAnnouncementBody("");
      setAnnouncementPriority("normal");
      setAnnouncementPinned(true);
    }
  }

  const pendingApplications = applications.filter(
    (item) => item.state === "pending"
  );

  if (loading) {
    return (
      <main className="rooms-live-page">
        <section className="rooms-live-state-card">
          <Loader2 aria-hidden="true" className="is-spinning" />
          <h1>Preparing Room discussions…</h1>
          <p>Private content remains hidden until Room access is confirmed.</p>
        </section>
      </main>
    );
  }

  if (!access?.allowed || !room) {
    return (
      <main className="rooms-live-page">
        <div className="rooms-live-shell rooms-live-access-shell">
          <section className="rooms-live-access-card">
            <span className="rooms-live-access-icon">
              <LockKeyhole aria-hidden="true" />
            </span>
            <p className="rooms-live-eyebrow">Private Room access</p>
            <h1>This Room requires approved membership.</h1>
            <p>
              Discussions, events, announcements, and member identities remain hidden
              until Room management approves access.
            </p>
            {message ? (
              <div className={`rooms-live-notice${messageIsError ? " is-error" : ""}`}>
                {message}
              </div>
            ) : null}
            {ownApplication ? (
              <div className="rooms-live-request-status">
                <UserCheck aria-hidden="true" />
                <div>
                  <strong>Request status: {ownApplication.state}</strong>
                  <span>Submitted {formatDateTime(ownApplication.createdAt)}</span>
                  {ownApplication.note ? <p>{ownApplication.note}</p> : null}
                </div>
              </div>
            ) : (
              <form onSubmit={requestAccess} className="rooms-live-access-form">
                <label htmlFor="room-access-note">Optional note to Room management</label>
                <textarea
                  id="room-access-note"
                  rows={4}
                  maxLength={1000}
                  value={accessNote}
                  onChange={(event) => setAccessNote(event.target.value)}
                  placeholder="Explain how you are connected to this Room"
                />
                <div className="rooms-live-form-footer">
                  <span>{accessNote.length}/1000</span>
                  <button
                    type="submit"
                    disabled={workingKey === "request-access"}
                    className="rooms-live-primary-action"
                  >
                    {workingKey === "request-access" ? (
                      <Loader2 aria-hidden="true" className="is-spinning" />
                    ) : (
                      <Send aria-hidden="true" />
                    )}
                    Send access request
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="rooms-live-page">
      <div className="rooms-live-shell">
        {message ? (
          <div className={`rooms-live-notice${messageIsError ? " is-error" : ""}`}>
            {message}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--rooms-live-muted)]">
            <span className="rooms-live-role-badge">
              <ShieldCheck aria-hidden="true" />
              {roleLabel(access.role)}
            </span>
            <span className="rooms-live-role-badge">
              {realtimeConnected ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
              {realtimeConnected ? "Live" : "Polling"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void loadWorkspace(true)}
            disabled={refreshing}
            className="rooms-live-secondary-action"
          >
            <RefreshCw
              aria-hidden="true"
              className={refreshing ? "is-spinning" : undefined}
            />
            {refreshing ? "Refreshing" : "Refresh Room"}
          </button>
        </div>

        <nav className="room-workspace-tabs" aria-label="Room workspace areas">
          {TABS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={activeTab === value}
              onClick={() => setActiveTab(value)}
            >
              <Icon aria-hidden="true" />
              {label}
              {value === "members" && pendingApplications.length > 0 ? (
                <span>{pendingApplications.length}</span>
              ) : null}
            </button>
          ))}
        </nav>

        {activeTab === "discussions" ? (
          <section className="room-workspace-panel room-workspace-discussions">
            <RoomDiscussionsDirect />
          </section>
        ) : null}

        {activeTab === "announcements" ? (
          <section className="room-workspace-panel">
            <div className="room-workspace-section-heading">
              <div>
                <p className="rooms-live-eyebrow">Room announcements</p>
                <h2>Leadership updates without feed noise</h2>
                <p>Priority and pinned updates remain easy for members to find.</p>
              </div>
            </div>
            {access.canManage ? (
              <form
                onSubmit={createAnnouncement}
                className="room-workspace-management-form"
              >
                <h3>Publish an announcement</h3>
                <label>
                  <span>Title</span>
                  <input
                    value={announcementTitle}
                    onChange={(event) => setAnnouncementTitle(event.target.value)}
                    maxLength={180}
                    required
                  />
                </label>
                <label>
                  <span>Announcement</span>
                  <textarea
                    rows={5}
                    maxLength={5000}
                    value={announcementBody}
                    onChange={(event) => setAnnouncementBody(event.target.value)}
                    required
                  />
                </label>
                <div className="room-workspace-form-grid">
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
                  <label className="room-workspace-checkbox">
                    <input
                      type="checkbox"
                      checked={announcementPinned}
                      onChange={(event) => setAnnouncementPinned(event.target.checked)}
                    />
                    <span>Pin this announcement</span>
                  </label>
                </div>
                <div className="rooms-live-form-footer">
                  <span>{announcementBody.length}/5000</span>
                  <button
                    type="submit"
                    className="rooms-live-primary-action"
                    disabled={
                      !announcementTitle.trim() ||
                      !announcementBody.trim() ||
                      workingKey === "create-announcement"
                    }
                  >
                    {workingKey === "create-announcement" ? (
                      <Loader2 aria-hidden="true" className="is-spinning" />
                    ) : (
                      <Megaphone aria-hidden="true" />
                    )}
                    Publish
                  </button>
                </div>
              </form>
            ) : null}
            {announcements.length > 0 ? (
              <div className="room-workspace-announcement-list is-full">
                {announcements.map((announcement) => (
                  <AnnouncementCard
                    key={announcement.id}
                    announcement={announcement}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                Icon={Megaphone}
                title="No announcements yet"
                description="Room leadership can publish important updates here."
              />
            )}
          </section>
        ) : null}

        {activeTab === "events" ? (
          <section className="room-workspace-panel">
            <div className="room-workspace-section-heading">
              <div>
                <p className="rooms-live-eyebrow">Shared events</p>
                <h2>Meetings, deadlines, classes, and Room dates</h2>
                <p>Every verified member sees the same schedule and context.</p>
              </div>
            </div>
            {access.canManage ? (
              <form onSubmit={createEvent} className="room-workspace-management-form">
                <h3>Add an event</h3>
                <div className="room-workspace-form-grid">
                  <label>
                    <span>Event title</span>
                    <input
                      value={eventTitle}
                      onChange={(event) => setEventTitle(event.target.value)}
                      maxLength={180}
                      required
                    />
                  </label>
                  <label>
                    <span>Location</span>
                    <input
                      value={eventLocation}
                      onChange={(event) => setEventLocation(event.target.value)}
                      maxLength={300}
                    />
                  </label>
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
                <label>
                  <span>Description</span>
                  <textarea
                    rows={3}
                    maxLength={3000}
                    value={eventDescription}
                    onChange={(event) => setEventDescription(event.target.value)}
                  />
                </label>
                <div className="rooms-live-form-footer">
                  <span>Visible to verified Room members</span>
                  <button
                    type="submit"
                    className="rooms-live-primary-action"
                    disabled={
                      !eventTitle.trim() ||
                      !eventStartsAt ||
                      workingKey === "create-event"
                    }
                  >
                    {workingKey === "create-event" ? (
                      <Loader2 aria-hidden="true" className="is-spinning" />
                    ) : (
                      <CalendarDays aria-hidden="true" />
                    )}
                    Add event
                  </button>
                </div>
              </form>
            ) : null}
            {events.length > 0 ? (
              <div className="room-workspace-event-grid">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <EmptyState
                Icon={CalendarDays}
                title="No Room events yet"
                description="Room leadership can publish the first shared date."
              />
            )}
          </section>
        ) : null}

        {activeTab === "members" ? (
          <div className="room-workspace-members-layout">
            <section className="room-workspace-panel">
              <div className="room-workspace-section-heading">
                <div>
                  <p className="rooms-live-eyebrow">Room members</p>
                  <h2>Verified people and explicit roles</h2>
                </div>
                <span>{members.length} members</span>
              </div>
              <div className="room-workspace-member-list">
                {members.map((member) => (
                  <article key={member.id} className="room-workspace-member">
                    <ProfileAvatar profile={member.profile} size="md" />
                    <div className="room-workspace-member-copy">
                      <strong>{getProfileDisplayName(member.profile)}</strong>
                      <span>
                        {member.profile?.username
                          ? `@${member.profile.username}`
                          : member.userId}
                      </span>
                      <small>Joined {formatDateTime(member.joinedAt)}</small>
                    </div>
                    <div className="room-workspace-member-controls">
                      {access.canManage && member.role !== "owner" ? (
                        <select
                          value={member.role}
                          onChange={(event) =>
                            void submitAction(
                              "update_member_role",
                              {
                                memberId: member.id,
                                role: event.target.value as Exclude<RoomRole, "owner">,
                              },
                              `role:${member.id}`,
                              "Room member role updated."
                            )
                          }
                          disabled={workingKey === `role:${member.id}`}
                          aria-label={`Role for ${getProfileDisplayName(member.profile)}`}
                        >
                          {MEMBER_ROLES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="rooms-live-role-badge">
                          {roleLabel(member.role)}
                        </span>
                      )}
                      {access.canManage && member.role !== "owner" ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Remove ${getProfileDisplayName(member.profile)} from this Room?`
                              )
                            )
                              return;
                            void submitAction(
                              "remove_member",
                              { memberId: member.id },
                              `remove:${member.id}`,
                              "Room member removed."
                            );
                          }}
                          disabled={workingKey === `remove:${member.id}`}
                          className="room-workspace-icon-action is-danger"
                          aria-label={`Remove ${getProfileDisplayName(member.profile)}`}
                        >
                          <UserMinus aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {access.canManage ? (
              <section className="room-workspace-panel">
                <div className="room-workspace-section-heading">
                  <div>
                    <p className="rooms-live-eyebrow">Access queue</p>
                    <h2>Membership requests</h2>
                  </div>
                  <span>{pendingApplications.length} pending</span>
                </div>
                {pendingApplications.length > 0 ? (
                  <div className="room-workspace-application-list">
                    {pendingApplications.map((application) => (
                      <article
                        key={application.id}
                        className="room-workspace-application"
                      >
                        <div className="room-workspace-author-row">
                          <ProfileAvatar profile={application.applicant} size="md" />
                          <div>
                            <strong>
                              {getProfileDisplayName(application.applicant)}
                            </strong>
                            <span>
                              Requested {formatRelativeTime(application.createdAt)}
                            </span>
                          </div>
                        </div>
                        {application.note ? <p>{application.note}</p> : null}
                        <div className="room-workspace-application-actions">
                          <button
                            type="button"
                            onClick={() =>
                              void submitAction(
                                "review_application",
                                { applicationId: application.id, state: "approved" },
                                `approve:${application.id}`,
                                "Room membership approved."
                              )
                            }
                            disabled={workingKey === `approve:${application.id}`}
                            className="rooms-live-primary-action"
                          >
                            <Check aria-hidden="true" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void submitAction(
                                "review_application",
                                { applicationId: application.id, state: "declined" },
                                `decline:${application.id}`,
                                "Access request declined."
                              )
                            }
                            disabled={workingKey === `decline:${application.id}`}
                            className="rooms-live-secondary-action"
                          >
                            Decline
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    Icon={UserCheck}
                    title="No pending requests"
                    description="New membership requests will appear here for review."
                  />
                )}
              </section>
            ) : null}
          </div>
        ) : null}

        <footer className="room-workspace-footer">
          <span>
            <Clock3 aria-hidden="true" />
            Snapshot {formatRelativeTime(generatedAt)}
          </span>
          <span>
            <ShieldCheck aria-hidden="true" />
            Role: {roleLabel(access.role)}
          </span>
          <span>
            <LockKeyhole aria-hidden="true" />
            Private Room content
          </span>
        </footer>
      </div>
    </main>
  );
}

function EventCard({ event }: { event: RoomEvent }) {
  return (
    <article className="room-workspace-event-card">
      <span className="room-workspace-event-icon">
        <CalendarDays aria-hidden="true" />
      </span>
      <div>
        <h3>{event.title}</h3>
        <p>{formatEventRange(event)}</p>
        {event.location ? (
          <span>
            <MapPin aria-hidden="true" />
            {event.location}
          </span>
        ) : null}
        {event.description ? <small>{event.description}</small> : null}
      </div>
    </article>
  );
}

function AnnouncementCard({
  announcement,
}: {
  announcement: RoomAnnouncement;
}) {
  return (
    <article
      className={`room-workspace-announcement ${priorityClass(
        announcement.priority
      )}`}
    >
      <div className="room-workspace-announcement-topline">
        <span>{announcement.priority}</span>
        {announcement.isPinned ? <strong>Pinned</strong> : null}
      </div>
      <h3>{announcement.title}</h3>
      <p>{announcement.body}</p>
      <small>
        {getProfileDisplayName(announcement.creator)} ·{" "}
        {formatRelativeTime(announcement.createdAt)}
      </small>
    </article>
  );
}

function EmptyState({
  Icon,
  title,
  description,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="room-workspace-empty">
      <Icon aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
