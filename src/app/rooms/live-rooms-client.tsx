"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Link2,
  LockKeyhole,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { RoomModelCard, RoomsSectionHeading } from "./rooms-v2-components";
import { ROOM_MODELS } from "./rooms-v2-model";

type RoomRole = "owner" | "administrator" | "moderator" | "member";
type RoomFilter = "all" | "owned" | "joined";

type RoomEventSummary = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
};

type LiveRoomSummary = {
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
  createdAt: string | null;
  updatedAt: string | null;
  role: RoomRole;
  memberCount: number;
  postCount: number;
  eventCount: number;
  announcementCount: number;
  latestActivityAt: string | null;
  nextEvent: RoomEventSummary | null;
};

type RoomsResponse = {
  generatedAt?: string;
  currentUserId?: string;
  rooms?: LiveRoomSummary[];
  summary?: {
    total: number;
    owned: number;
    joined: number;
    upcomingEvents: number;
  };
  error?: string;
  code?: string;
};

const FILTERS: Array<{ value: RoomFilter; label: string }> = [
  { value: "all", label: "All rooms" },
  { value: "owned", label: "Owned" },
  { value: "joined", label: "Joined" },
];

function formatDateTime(value: string | null | undefined) {
  if (!value) return "No date";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "No date";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "No recent activity";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "No recent activity";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateTime(value);
}

function roleLabel(role: RoomRole) {
  if (role === "owner") return "Owner";
  if (role === "administrator") return "Administrator";
  if (role === "moderator") return "Moderator";
  return "Member";
}

function roomInviteToken(value: string) {
  const input = value.trim();
  if (!input) return null;

  const tokenPattern = /^[A-Za-z0-9_-]{20,300}$/;
  if (tokenPattern.test(input)) return input;

  try {
    const invitation = new URL(input, "https://loombus.com");
    const pathname = invitation.pathname.replace(/\/+$/, "") || "/";
    if (pathname !== "/rooms/join") return null;
    const token = invitation.searchParams.get("token")?.trim() ?? "";
    return tokenPattern.test(token) ? token : null;
  } catch {
    return null;
  }
}

export default function LiveRoomsClient() {
  const [rooms, setRooms] = useState<LiveRoomSummary[]>([]);
  const [summary, setSummary] = useState<RoomsResponse["summary"]>({
    total: 0,
    owned: 0,
    joined: 0,
    upcomingEvents: 0,
  });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RoomFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const loadRooms = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login?next=/rooms";
        return;
      }

      const response = await fetch("/api/rooms", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as RoomsResponse;

      if (response.status === 401) {
        window.location.href = "/login?next=/rooms";
        return;
      }

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load your rooms.");
      }

      const nextRooms = Array.isArray(result.rooms) ? result.rooms : [];
      setRooms(nextRooms);
      setSummary(
        result.summary ?? {
          total: nextRooms.length,
          owned: nextRooms.filter((room) => room.role === "owner").length,
          joined: nextRooms.filter((room) => room.role !== "owner").length,
          upcomingEvents: nextRooms.filter((room) => Boolean(room.nextEvent)).length,
        }
      );
      setGeneratedAt(result.generatedAt ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load your rooms.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms(false);
  }, [loadRooms]);

  useEffect(() => {
    const channel = supabase
      .channel("live-rooms-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        () => void loadRooms(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members" },
        () => void loadRooms(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_posts" },
        () => void loadRooms(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_events" },
        () => void loadRooms(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_announcements" },
        () => void loadRooms(true)
      )
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));

    const fallback = window.setInterval(() => void loadRooms(true), 45_000);

    return () => {
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [loadRooms]);

  function joinWithInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = roomInviteToken(inviteInput);
    if (!token) {
      setInviteMessage(
        "Paste a complete Loombus Room invitation link or a valid invitation token."
      );
      return;
    }

    setInviteMessage("");
    window.location.assign(`/rooms/join?token=${encodeURIComponent(token)}`);
  }

  const visibleRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return rooms.filter((room) => {
      if (filter === "owned" && room.role !== "owner") return false;
      if (filter === "joined" && room.role === "owner") return false;
      if (!normalized) return true;

      return [
        room.name,
        room.description,
        room.roomType,
        room.templateKey,
        roleLabel(room.role),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [filter, query, rooms]);

  if (loading) {
    return (
      <main className="rooms-live-page">
        <section className="rooms-live-state-card">
          <p className="rooms-live-eyebrow">Private Rooms</p>
          <h1>Opening your rooms…</h1>
          <p>Verifying your active memberships and private Room access.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="rooms-live-page">
      <div className="rooms-live-shell">
        <header className="rooms-live-hero">
          <div>
            <p className="rooms-live-eyebrow">Live Private Rooms</p>
            <h1>Discussion, coordination, and shared dates in one private place.</h1>
            <p>
              Rooms connect structured private conversations with announcements,
              members, access requests, and a shared calendar. Content stays visible
              only to verified Room members.
            </p>
          </div>

          <div className="rooms-live-hero-actions">
            <Link href="/rooms/new" className="rooms-live-primary-action">
              <Plus aria-hidden="true" />
              Create a Room
            </Link>
            <button
              type="button"
              onClick={() => void loadRooms(true)}
              disabled={refreshing}
              className="rooms-live-secondary-action"
            >
              <RefreshCw
                aria-hidden="true"
                className={refreshing ? "is-spinning" : undefined}
              />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </header>

        <div className="rooms-live-status-row">
          <span className={realtimeConnected ? "is-live" : "is-fallback"}>
            {realtimeConnected ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
            {realtimeConnected ? "Live updates connected" : "Refresh fallback active"}
          </span>
          <span>
            <LockKeyhole aria-hidden="true" />
            Membership verified server-side
          </span>
          {generatedAt && (
            <span>
              <Clock3 aria-hidden="true" />
              Updated {formatRelativeTime(generatedAt)}
            </span>
          )}
        </div>

        {message && <div className="rooms-live-notice is-error">{message}</div>}

        <section className="rooms-live-metrics" aria-label="Room summary">
          <article><span>Active rooms</span><strong>{summary?.total ?? rooms.length}</strong></article>
          <article><span>Owned</span><strong>{summary?.owned ?? 0}</strong></article>
          <article><span>Joined</span><strong>{summary?.joined ?? 0}</strong></article>
          <article><span>Rooms with upcoming dates</span><strong>{summary?.upcomingEvents ?? 0}</strong></article>
        </section>

        <section className="rooms-live-directory rooms-live-invite-entry">
          <div className="rooms-live-directory-heading">
            <div>
              <p className="rooms-live-eyebrow">Join a private Room</p>
              <h2>Paste a Room invitation link.</h2>
              <p>
                Loombus verifies the invitation, your account, the Room capacity, and
                any approval requirements before granting access.
              </p>
            </div>
          </div>
          <form className="rooms-live-toolbar" onSubmit={joinWithInvitation}>
            <label className="rooms-live-search">
              <Link2 aria-hidden="true" />
              <span className="sr-only">Room invitation link or token</span>
              <input
                type="text"
                value={inviteInput}
                onChange={(event) => {
                  setInviteInput(event.target.value);
                  setInviteMessage("");
                }}
                placeholder="Paste the Loombus Room invitation link"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <button type="submit" className="rooms-live-primary-action">
              <ArrowRight aria-hidden="true" />
              Join Room
            </button>
          </form>
          {inviteMessage ? (
            <div className="rooms-live-notice is-error" role="alert">
              {inviteMessage}
            </div>
          ) : null}
        </section>

        <section className="rooms-live-directory">
          <div className="rooms-live-directory-heading">
            <div>
              <p className="rooms-live-eyebrow">Your rooms</p>
              <h2>Private spaces you can enter now.</h2>
              <p>
                Each card reflects a verified owner or membership record. No sample
                members, posts, events, or activity are shown as live account data.
              </p>
            </div>
          </div>

          <div className="rooms-live-toolbar">
            <label className="rooms-live-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Search your rooms</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Room name, purpose, type, or role"
              />
            </label>

            <div className="rooms-live-filter-row" aria-label="Filter rooms">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={filter === item.value}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {visibleRooms.length > 0 ? (
            <div className="rooms-live-grid">
              {visibleRooms.map((room) => (
                <article key={room.id} className="rooms-live-card">
                  <div className="rooms-live-card-topline">
                    <span className="rooms-live-role-badge">
                      <ShieldCheck aria-hidden="true" />
                      {roleLabel(room.role)}
                    </span>
                    <span className="rooms-live-private-badge">
                      <LockKeyhole aria-hidden="true" />
                      Private
                    </span>
                  </div>

                  <div className="rooms-live-card-copy">
                    <p>{room.roomType.replaceAll("_", " ")}</p>
                    <h3>{room.name}</h3>
                    <span>{room.description}</span>
                  </div>

                  <div className="rooms-live-card-stats">
                    <span><Users aria-hidden="true" />{room.memberCount} members</span>
                    <span><MessageSquareText aria-hidden="true" />{room.postCount} posts</span>
                    <span><CalendarDays aria-hidden="true" />{room.eventCount} events</span>
                  </div>

                  {room.nextEvent ? (
                    <div className="rooms-live-next-event">
                      <CalendarDays aria-hidden="true" />
                      <div>
                        <strong>{room.nextEvent.title}</strong>
                        <span>{formatDateTime(room.nextEvent.startsAt)}</span>
                        {room.nextEvent.location && <small>{room.nextEvent.location}</small>}
                      </div>
                    </div>
                  ) : (
                    <div className="rooms-live-next-event is-empty">
                      <CheckCircle2 aria-hidden="true" />
                      <span>No upcoming Room event.</span>
                    </div>
                  )}

                  <div className="rooms-live-card-footer">
                    <span>Activity {formatRelativeTime(room.latestActivityAt)}</span>
                    <Link href={`/rooms/${encodeURIComponent(room.id)}`}>
                      Open Room
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : rooms.length > 0 ? (
            <div className="rooms-live-empty">
              <Search aria-hidden="true" />
              <h3>No Room matches those filters.</h3>
              <p>Clear the search or select another Room group.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="rooms-live-empty is-primary">
              <LockKeyhole aria-hidden="true" />
              <h3>No active Room membership was found.</h3>
              <p>
                Create a Free Room immediately or choose a paid monthly plan. Paid Rooms
                are provisioned only after Stripe confirms the subscription.
              </p>
              <Link href="/rooms/new" className="rooms-live-primary-action">
                Create your first Room
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>

        {rooms.length === 0 && (
          <section className="rooms-live-models">
            <RoomsSectionHeading
              eyebrow="Room models"
              title="Start with a structure that matches the group."
              description="Choose a model, select a Free or paid monthly plan, and create a private Room with verified ownership."
              action={{ href: "/rooms/new", label: "Create a Room" }}
            />
            <div className="rooms-v2-model-grid">
              {ROOM_MODELS.slice(0, 4).map((model) => (
                <RoomModelCard key={model.id} model={model} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
