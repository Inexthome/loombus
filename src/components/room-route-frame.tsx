"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  CalendarDays,
  CreditCard,
  FileClock,
  Flag,
  House,
  LockKeyhole,
  Megaphone,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";

type ShellPayload = {
  room: {
    id: string;
    name: string;
    description: string;
    roomType: string;
    status: string;
    subscriptionPlan: string;
    subscriptionStatus: string;
    plan: { id: string; label: string };
  };
  access: {
    allowed: boolean;
    role: string | null;
    isOwner: boolean;
    canManage: boolean;
    canModerate: boolean;
    operationsEnabled: boolean;
  };
  metrics: {
    members: number;
    discussions: number;
    upcomingEvents: number;
    announcements: number;
    pendingApplications: number;
  };
  nextEvent: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string | null;
    location: string | null;
  } | null;
  pinnedAnnouncement: {
    id: string;
    title: string;
    priority: string;
    createdAt: string | null;
  } | null;
  error?: string;
};

type NavItem = {
  href: string;
  label: string;
  Icon: typeof House;
};

function roleLabel(value: string | null) {
  if (value === "owner") return "Owner";
  if (value === "administrator") return "Administrator";
  if (value === "moderator") return "Moderator";
  return "Member";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function routeIsActive(pathname: string, href: string, roomBase: string) {
  const target = href.split("?")[0];
  if (target === roomBase) return pathname === roomBase || pathname === `${roomBase}/`;
  return pathname === target || pathname.startsWith(`${target}/`);
}

export default function RoomRouteFrame({ children }: { children: ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [shellState, setShellState] = useState<"loading" | "ready" | "unavailable">("loading");
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    if (!roomId) return;
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(pathname || `/rooms/${roomId}`)}`;
      return;
    }

    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/shell`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const result = (await response.json().catch(() => ({}))) as ShellPayload;
    if (requestSequence.current !== sequence) return;
    if (!response.ok || !result.room || !result.access) {
      setShellState((current) => (current === "loading" ? "unavailable" : current));
      return;
    }
    setPayload(result);
    setShellState("ready");
  }, [pathname, roomId]);

  useEffect(() => {
    setPayload(null);
    setShellState("loading");
    void load();
    const refresh = () => void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);
    window.addEventListener("loombus:room-activity-changed", refresh);
    return () => {
      requestSequence.current += 1;
      window.clearInterval(interval);
      window.removeEventListener("loombus:room-activity-changed", refresh);
    };
  }, [load]);

  if (!roomId || shellState !== "ready" || !payload) return <>{children}</>;

  const roomBase = `/rooms/${encodeURIComponent(roomId)}`;
  const primary: NavItem[] = [
    { href: roomBase, label: "Room home", Icon: House },
    { href: `${roomBase}/calendar`, label: "Calendar", Icon: CalendarDays },
    {
      href: `${roomBase}/tools`,
      label: payload.access.isOwner ? "Search and lifecycle" : "Search Room",
      Icon: Search,
    },
    { href: `${roomBase}/notifications`, label: "Notifications", Icon: Bell },
    {
      href: `${roomBase}/moderation`,
      label: payload.access.canModerate ? "Moderation" : "Report issue",
      Icon: Flag,
    },
  ];

  const management: NavItem[] = [];
  if (payload.access.canManage && payload.access.operationsEnabled) {
    management.push({ href: `${roomBase}/analytics`, label: "Analytics", Icon: BarChart3 });
  }
  if (payload.access.canManage) {
    management.push({ href: `${roomBase}/governance`, label: "Governance", Icon: ShieldCheck });
  }
  if (payload.access.isOwner) {
    management.push({ href: `${roomBase}/retention`, label: "Retention", Icon: FileClock });
    management.push({ href: `${roomBase}/billing`, label: "Billing", Icon: CreditCard });
  }

  return (
    <div className="room-route-page">
      <a href="#room-route-content" className="room-route-skip-link">
        Skip to Room content
      </a>
      <div className="room-route-layout">
        <aside className="room-route-left" aria-label="Room navigation">
          <div className="room-route-left-sticky">
            <Link href="/rooms" className="room-route-all-rooms">
              <ArrowLeft aria-hidden="true" /> All Rooms
            </Link>

            <section className="room-route-identity">
              <span className="room-route-identity-icon">
                <LockKeyhole aria-hidden="true" />
              </span>
              <p>{payload.room.roomType.replaceAll("_", " ") || "Private Room"}</p>
              <h2>{payload.room.name}</h2>
              {payload.room.description ? <span>{payload.room.description}</span> : null}
            </section>

            <nav className="room-route-nav" aria-label="Room workspace">
              <p>Workspace</p>
              {primary.map(({ href, label, Icon }) => {
                const active = routeIsActive(pathname, href, roomBase);
                return (
                  <Link key={href} href={href} aria-current={active ? "page" : undefined}>
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                );
              })}

              {management.length > 0 ? <p>Management</p> : null}
              {management.map(({ href, label, Icon }) => {
                const active = routeIsActive(pathname, href, roomBase);
                return (
                  <Link key={href} href={href} aria-current={active ? "page" : undefined}>
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                    {label === "Governance" && payload.metrics.pendingApplications > 0 ? (
                      <strong>{payload.metrics.pendingApplications}</strong>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <div id="room-route-content" className="room-route-content">
          {children}
        </div>

        <aside className="room-route-right" aria-label="Room context">
          <div className="room-route-right-sticky">
            <section className="room-route-card">
              <div className="room-route-card-heading">
                <div>
                  <p>Room snapshot</p>
                  <h2>Current activity</h2>
                </div>
                <Users aria-hidden="true" />
              </div>
              <div className="room-route-metrics">
                <span><strong>{payload.metrics.members}</strong>Members</span>
                <span><strong>{payload.metrics.discussions}</strong>Discussions</span>
                <span><strong>{payload.metrics.upcomingEvents}</strong>Upcoming</span>
                <span><strong>{payload.metrics.announcements}</strong>Updates</span>
              </div>
            </section>

            {payload.nextEvent ? (
              <section className="room-route-card">
                <div className="room-route-card-heading">
                  <div>
                    <p>Next date</p>
                    <h2>{payload.nextEvent.title}</h2>
                  </div>
                  <CalendarDays aria-hidden="true" />
                </div>
                <span className="room-route-card-detail">
                  {formatDateTime(payload.nextEvent.startsAt)}
                </span>
                {payload.nextEvent.location ? (
                  <span className="room-route-card-detail">{payload.nextEvent.location}</span>
                ) : null}
                <Link href={`${roomBase}/calendar`}>Open calendar</Link>
              </section>
            ) : null}

            {payload.pinnedAnnouncement ? (
              <section className="room-route-card">
                <div className="room-route-card-heading">
                  <div>
                    <p>Pinned update</p>
                    <h2>{payload.pinnedAnnouncement.title}</h2>
                  </div>
                  <Megaphone aria-hidden="true" />
                </div>
                <span className="room-route-card-detail">
                  {payload.pinnedAnnouncement.priority.replaceAll("_", " ")}
                </span>
                <Link href={roomBase}>View Room home</Link>
              </section>
            ) : null}

            <section className="room-route-card room-route-security-card">
              <LockKeyhole aria-hidden="true" />
              <div>
                <strong>Private Room</strong>
                <span>
                  {roleLabel(payload.access.role)} · {payload.room.plan.label || "Room plan"}
                </span>
                <small>
                  Access and tool permissions remain enforced by the existing Room APIs.
                </small>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
