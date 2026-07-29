"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  CreditCard,
  FileClock,
  Flag,
  Loader2,
  LockKeyhole,
  Search,
  ShieldCheck,
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
import { RoomUnifiedMenu } from "@/components/room-unified-menu";
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
    pendingApplications: number;
  };
  error?: string;
};

type RouteItem = {
  href: string;
  label: string;
  Icon: typeof Search;
  badge?: number;
};

function roleLabel(value: string | null) {
  if (value === "owner") return "Owner";
  if (value === "administrator") return "Administrator";
  if (value === "moderator") return "Moderator";
  return "Member";
}

function routeIsActive(pathname: string, href: string) {
  const target = href.split("?")[0];
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
  const [shellState, setShellState] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    if (!roomId) return;
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(
        pathname || `/rooms/${roomId}`
      )}`;
      return;
    }

    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/shell`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const result = (await response.json().catch(() => ({}))) as ShellPayload;
    if (requestSequence.current !== sequence) return;
    if (!response.ok || !result.room || !result.access) {
      setShellState("unavailable");
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

  if (!roomId || shellState === "loading") {
    return (
      <main className="room-simple-loading" aria-busy="true" aria-live="polite">
        <Loader2 aria-hidden="true" className="is-spinning" />
        <strong>Opening Room…</strong>
      </main>
    );
  }

  if (shellState === "unavailable" || !payload) return <>{children}</>;

  const roomBase = `/rooms/${encodeURIComponent(roomId)}`;
  const routes: RouteItem[] = [
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

  if (payload.access.canManage && payload.access.operationsEnabled) {
    routes.push({ href: `${roomBase}/analytics`, label: "Analytics", Icon: BarChart3 });
  }
  if (payload.access.canManage) {
    routes.push({
      href: `${roomBase}/governance`,
      label: "Governance",
      Icon: ShieldCheck,
      badge: payload.metrics.pendingApplications,
    });
  }
  if (payload.access.isOwner) {
    routes.push({ href: `${roomBase}/retention`, label: "Retention", Icon: FileClock });
    routes.push({ href: `${roomBase}/billing`, label: "Billing", Icon: CreditCard });
  }

  return (
    <div className="room-simple-page">
      <a href="#room-simple-content" className="room-route-skip-link">
        Skip to Room content
      </a>

      <aside className="room-simple-sidebar" aria-label="Room navigation">
        <div className="room-simple-sidebar-sticky">
          <Link href="/rooms" className="room-simple-all-rooms">
            <ArrowLeft aria-hidden="true" />
            All Rooms
          </Link>

          <section className="room-simple-room-context">
            <LockKeyhole aria-hidden="true" />
            <div>
              <strong>{payload.room.name}</strong>
              <span>
                {roleLabel(payload.access.role)} · {payload.room.plan.label}
              </span>
            </div>
          </section>

          <RoomUnifiedMenu />

          <nav className="room-simple-route-menu" aria-label="Room tools">
            <p>Tools</p>
            {routes.map(({ href, label, Icon, badge }) => {
              const active = routeIsActive(pathname, href);
              return (
                <Link key={href} href={href} aria-current={active ? "page" : undefined}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                  {badge && badge > 0 ? <strong>{badge}</strong> : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <main id="room-simple-content" className="room-simple-content">
        <header className="room-simple-header">
          <h1>{payload.room.name}</h1>
        </header>
        {children}
      </main>
    </div>
  );
}
