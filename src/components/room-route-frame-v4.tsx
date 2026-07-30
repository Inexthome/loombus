"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  ContactRound,
  CreditCard,
  FileClock,
  Flag,
  FolderLock,
  LayoutDashboard,
  Link2,
  ListTodo,
  Loader2,
  LockKeyhole,
  MailOpen,
  Megaphone,
  Menu,
  MessageSquareText,
  Network,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  TriangleAlert,
  UserPlus,
  Users,
  Vote,
  Workflow,
  Wrench,
  X,
  type LucideIcon,
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
import type {
  RoomFeatureLaunch,
  RoomOperationsView,
  RoomStudioView,
} from "@/components/room-feature-events";
import { useRoomWorkspace } from "@/components/room-workspace-context";
import { RoomsAppearanceControl } from "@/components/rooms-shell";
import {
  getRoomModelModuleDefinition,
  getRoomModelProfile,
} from "@/lib/room-model-profiles";
import {
  ROOM_MODULE_DEFINITIONS,
  getRoomPlanEntitlements,
  type RoomModuleDefinition,
  type RoomModuleKey,
} from "@/lib/room-plan-entitlements";
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
  error?: string;
};

type RouteNavItem = {
  kind: "route";
  id: string;
  href: string;
  label: string;
  Icon: LucideIcon;
  badge?: number;
};

type FeatureNavItem = {
  kind: "feature";
  id: string;
  label: string;
  Icon: LucideIcon;
  badge?: number;
  feature: RoomFeatureLaunch;
};

type SecondaryRailKey = "settings" | "studio" | "operations";

type GroupNavItem = {
  kind: "group";
  id: string;
  label: string;
  Icon: LucideIcon;
  group: SecondaryRailKey;
  badge?: number;
};

type NavItem = RouteNavItem | FeatureNavItem | GroupNavItem;
type ShellState = "loading" | "ready" | "restricted" | "not-found" | "error";

const SHELL_LOADING_MESSAGE =
  "Membership and Room permissions are being verified before private content is shown.";
const WORKSPACE_MODULE_KEYS: RoomModuleKey[] = [
  "overview",
  "discussions",
  "calendar",
  "announcements",
  "members",
];
const WORK_MODULE_KEYS: RoomModuleKey[] = [
  "requests",
  "resources",
  "tasks",
  "polls",
  "directory",
  "knowledge",
  "files",
  "forms",
  "services",
];
const MANAGEMENT_MODULE_KEYS: RoomModuleKey[] = [
  "settings",
  "invites",
  "admin-tools",
  "member-workflows",
  "enterprise-controls",
  "high-capacity",
  "community-operations",
];
const STUDIO_PLAN_KEYS = new Set([
  "pro",
  "organization",
  "organization-plus",
  "enterprise",
]);
const ORGANIZATION_PLAN_KEYS = new Set([
  "organization",
  "organization-plus",
  "enterprise",
]);
const MODULE_ICONS: Record<RoomModuleKey, LucideIcon> = {
  overview: LayoutDashboard,
  discussions: MessageSquareText,
  calendar: CalendarDays,
  announcements: Megaphone,
  members: Users,
  requests: Wrench,
  resources: Link2,
  settings: Settings,
  tasks: ListTodo,
  polls: Vote,
  directory: ContactRound,
  knowledge: BookOpen,
  files: FolderLock,
  forms: ClipboardList,
  services: Store,
  invites: UserPlus,
  activity: ScrollText,
  "advanced-controls": SlidersHorizontal,
  "admin-tools": ShieldCheck,
  operations: BarChart3,
  "member-workflows": Workflow,
  "enterprise-controls": Building2,
  "high-capacity": Network,
  "community-operations": LockKeyhole,
};

function roleLabel(value: string | null) {
  if (value === "owner") return "Owner";
  if (value === "administrator" || value === "admin") return "Administrator";
  if (value === "moderator") return "Moderator";
  return "Member";
}

function routeIsActive(pathname: string, href: string, roomBase: string) {
  if (href === roomBase) return pathname === roomBase || pathname === `${roomBase}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function currentRouteDestination(roomId: string) {
  if (typeof window === "undefined") return `/rooms/${roomId}`;
  return `${window.location.pathname}${window.location.search}` || `/rooms/${roomId}`;
}

function roleCanOpenModule(
  definition: RoomModuleDefinition,
  access: ShellPayload["access"]
) {
  if (definition.minimumRole === "member") return access.allowed;
  if (definition.minimumRole === "manager") return access.canManage;
  return access.isOwner;
}

function RoomShellState({
  state,
  message,
  onRetry,
}: {
  state: Exclude<ShellState, "ready" | "restricted">;
  message: string;
  onRetry?: () => void;
}) {
  const loading = state === "loading";
  const notFound = state === "not-found";
  const Icon = loading ? Loader2 : notFound ? LockKeyhole : TriangleAlert;
  const title = loading
    ? "Preparing your private Room"
    : notFound
      ? "Room unavailable"
      : "The Room could not be opened";
  return (
    <div className="rooms-phase1-state-page" role={loading ? "status" : undefined}>
      <section className="rooms-phase1-state-card">
        <span className="rooms-phase1-state-mark">
          <Icon aria-hidden="true" className={loading ? "is-spinning" : undefined} />
        </span>
        <h1>{title}</h1>
        <p>{message}</p>
        {!loading ? (
          <div className="rooms-phase1-state-actions">
            {onRetry ? (
              <button type="button" className="is-primary" onClick={onRetry}>
                <RefreshCw aria-hidden="true" size={16} /> Try again
              </button>
            ) : null}
            <Link href="/rooms">Back to Rooms</Link>
            <Link href="/home">Back to Loombus</Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function RoomRouteFrameV4({ children }: { children: ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const checkoutReturn = pathname.endsWith("/billing/success");
  const { activeFeature, openFeature, closeFeature } = useRoomWorkspace();
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [shellState, setShellState] = useState<ShellState>("loading");
  const [shellMessage, setShellMessage] = useState(SHELL_LOADING_MESSAGE);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [secondaryRail, setSecondaryRail] = useState<SecondaryRailKey | null>(null);
  const requestSequence = useRef(0);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    setSecondaryRail(null);
  }, []);

  const load = useCallback(
    async (initial = false) => {
      if (!roomId || checkoutReturn) return;
      const sequence = ++requestSequence.current;
      if (initial) {
        setShellState("loading");
        setShellMessage(SHELL_LOADING_MESSAGE);
      } else {
        setRefreshing(true);
      }
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) {
          window.location.href = `/login?next=${encodeURIComponent(
            currentRouteDestination(roomId)
          )}`;
          return;
        }
        const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/shell`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const result = (await response.json().catch(() => ({}))) as ShellPayload;
        if (requestSequence.current !== sequence) return;
        if (response.status === 401) {
          window.location.href = `/login?next=${encodeURIComponent(
            currentRouteDestination(roomId)
          )}`;
          return;
        }
        if (response.status === 403) {
          setPayload(null);
          setShellMessage(result.error || "Approved Room membership is required.");
          setShellState("restricted");
          return;
        }
        if (response.status === 404) {
          setPayload(null);
          setShellMessage("This Room does not exist or is no longer available to this account.");
          setShellState("not-found");
          return;
        }
        if (!response.ok || !result.room || !result.access) {
          setPayload(null);
          setShellMessage(result.error || "The Rooms service did not return a usable workspace.");
          setShellState("error");
          return;
        }
        setPayload(result);
        setShellMessage("");
        setShellState("ready");
      } catch {
        if (requestSequence.current !== sequence) return;
        setPayload(null);
        setShellMessage(
          "The Rooms service could not be reached. Your private content was not rendered."
        );
        setShellState("error");
      } finally {
        if (requestSequence.current === sequence) setRefreshing(false);
      }
    },
    [checkoutReturn, roomId]
  );

  useEffect(() => {
    setPayload(null);
    if (checkoutReturn) return;
    void load(true);
    const refresh = () => void load(false);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);
    window.addEventListener("loombus:room-activity-changed", refresh);
    return () => {
      requestSequence.current += 1;
      window.clearInterval(interval);
      window.removeEventListener("loombus:room-activity-changed", refresh);
    };
  }, [checkoutReturn, load]);

  useEffect(() => {
    closeSidebar();
    closeFeature({ restoreFocus: false });
  }, [closeFeature, closeSidebar, pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (secondaryRail) setSecondaryRail(null);
      else closeSidebar();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeSidebar, secondaryRail, sidebarOpen]);

  if (checkoutReturn || !roomId) return <>{children}</>;
  const payloadMatchesRoom = payload?.room.id === roomId;
  if (shellState === "loading" || (shellState === "ready" && !payloadMatchesRoom)) {
    return <RoomShellState state="loading" message={SHELL_LOADING_MESSAGE} />;
  }
  if (shellState === "not-found") {
    return <RoomShellState state="not-found" message={shellMessage} />;
  }
  if (shellState === "error") {
    return <RoomShellState state="error" message={shellMessage} onRetry={() => void load(true)} />;
  }
  if (shellState === "restricted") {
    return (
      <div className="rooms-phase1-restricted-shell">
        <header className="rooms-phase1-restricted-header">
          <Link href="/rooms" className="rooms-phase1-brand">
            <span className="rooms-phase1-brand-mark" aria-hidden="true">
              <img src="/assets/brand/loombus-mark-transparent.png" alt="" />
            </span>
            <span><strong>Loombus</strong><small>Private Room</small></span>
          </Link>
          <div className="rooms-phase1-hub-actions">
            <RoomsAppearanceControl compact />
            <Link href="/rooms" className="rooms-phase1-back-link">
              <ArrowLeft aria-hidden="true" /> Back to Rooms
            </Link>
          </div>
        </header>
        <div className="rooms-phase1-restricted-content">{children}</div>
      </div>
    );
  }
  if (!payload || !payloadMatchesRoom) {
    return (
      <RoomShellState
        state="error"
        message="The Room shell completed without a verified workspace."
        onRetry={() => void load(true)}
      />
    );
  }

  const roomBase = `/rooms/${encodeURIComponent(roomId)}`;
  const profile = getRoomModelProfile(payload.room.roomType);
  const plan = getRoomPlanEntitlements(
    payload.room.subscriptionPlan,
    payload.room.subscriptionStatus
  );
  const moduleDefinitions = new Map(
    plan.modules
      .map((moduleKey) =>
        getRoomModelModuleDefinition(
          payload.room.roomType,
          moduleKey,
          ROOM_MODULE_DEFINITIONS[moduleKey]
        )
      )
      .filter((definition) => roleCanOpenModule(definition, payload.access))
      .map((definition) => [definition.id, definition] as const)
  );

  const badgeForModule = (moduleKey: RoomModuleKey) => {
    if (moduleKey === "discussions") return payload.metrics.discussions;
    if (moduleKey === "calendar") return payload.metrics.upcomingEvents;
    if (moduleKey === "announcements") return payload.metrics.announcements;
    if (moduleKey === "members") return payload.metrics.members;
    if (moduleKey === "invites") return payload.metrics.pendingApplications;
    return undefined;
  };

  const itemForModule = (moduleKey: RoomModuleKey): NavItem | null => {
    const definition = moduleDefinitions.get(moduleKey);
    if (!definition) return null;
    const Icon = MODULE_ICONS[moduleKey];
    const badge = badgeForModule(moduleKey);
    if (moduleKey === "settings") {
      return {
        kind: "group",
        id: "group:settings",
        label: definition.label,
        Icon,
        badge,
        group: "settings",
      };
    }
    const routeByModule: Partial<Record<RoomModuleKey, string>> = {
      overview: `${roomBase}/overview`,
      discussions: roomBase,
      calendar: `${roomBase}/calendar`,
      announcements: `${roomBase}/announcements`,
      members: `${roomBase}/members`,
    };
    const href = routeByModule[moduleKey];
    if (href) {
      return { kind: "route", id: `route:${moduleKey}`, href, label: definition.label, Icon, badge };
    }
    const feature: RoomFeatureLaunch = {
      id: `module:${moduleKey}`,
      kind: "module",
      moduleKey,
      label: definition.label,
    };
    return { kind: "feature", id: feature.id, label: definition.label, Icon, badge, feature };
  };

  const workspace = WORKSPACE_MODULE_KEYS.map(itemForModule).filter(
    (item): item is NavItem => Boolean(item)
  );
  const workAndResources = WORK_MODULE_KEYS.map(itemForModule).filter(
    (item): item is NavItem => Boolean(item)
  );
  const managementModules = MANAGEMENT_MODULE_KEYS.map(itemForModule).filter(
    (item): item is NavItem => Boolean(item)
  );

  const roomTools: NavItem[] = [
    {
      kind: "feature",
      id: "foundation:search",
      label: "Search this Room",
      Icon: Search,
      feature: { id: "foundation:search", kind: "foundation", panel: "search", label: "Search this Room" },
    },
    {
      kind: "feature",
      id: "foundation:inbox",
      label: "Room Inbox",
      Icon: MailOpen,
      feature: { id: "foundation:inbox", kind: "foundation", panel: "inbox", label: "Room Inbox" },
    },
    ...(payload.access.canManage
      ? [{ kind: "route" as const, id: "route:tools", href: `${roomBase}/tools`, label: "Search & lifecycle controls", Icon: SlidersHorizontal }]
      : []),
    ...(STUDIO_PLAN_KEYS.has(plan.id)
      ? [{ kind: "group" as const, id: "group:studio", label: "Room Studio", Icon: Wrench, group: "studio" as const }]
      : []),
    ...(payload.access.canManage || payload.access.canModerate
      ? [{ kind: "group" as const, id: "group:operations", label: "Room Operations", Icon: ShieldCheck, group: "operations" as const }]
      : []),
    { kind: "route", id: "route:notifications", href: `${roomBase}/notifications`, label: "Notifications", Icon: Bell },
    { kind: "route", id: "route:moderation", href: `${roomBase}/moderation`, label: payload.access.canModerate ? "Moderation" : "Report issue", Icon: Flag },
  ];

  const managementRoutes: NavItem[] = [];
  if (payload.access.canManage && payload.access.operationsEnabled) {
    managementRoutes.push({ kind: "route", id: "route:analytics", href: `${roomBase}/analytics`, label: "Analytics", Icon: BarChart3 });
  }
  const management = [...managementModules, ...managementRoutes];

  const moduleFeatureItem = (
    moduleKey: RoomModuleKey,
    fallbackLabel: string,
    Icon: LucideIcon
  ): FeatureNavItem | null => {
    const definition = moduleDefinitions.get(moduleKey);
    if (!definition) return null;
    const label = definition.label || fallbackLabel;
    return {
      kind: "feature",
      id: `module:${moduleKey}`,
      label,
      Icon,
      feature: { id: `module:${moduleKey}`, kind: "module", moduleKey, label },
    };
  };

  const settingsItems = [
    moduleDefinitions.has("settings")
      ? {
          kind: "feature" as const,
          id: "module:settings",
          label: "General Room Settings",
          Icon: Settings,
          feature: {
            id: "module:settings",
            kind: "module" as const,
            moduleKey: "settings" as const,
            label: "General Room Settings",
          },
        }
      : null,
    moduleFeatureItem("activity", "Activity / Audit Log", ScrollText),
    moduleFeatureItem("advanced-controls", "Advanced Room Controls", SlidersHorizontal),
    payload.access.canManage
      ? { kind: "route" as const, id: "route:governance", href: `${roomBase}/governance`, label: "Ownership & Governance", Icon: ShieldCheck, badge: payload.metrics.pendingApplications }
      : null,
    payload.access.canManage
      ? { kind: "route" as const, id: "route:age-safety", href: `${roomBase}/age-safety`, label: "Minor Safety", Icon: ShieldCheck }
      : null,
    payload.access.isOwner
      ? { kind: "route" as const, id: "route:retention", href: `${roomBase}/retention`, label: "Retention", Icon: FileClock }
      : null,
    payload.access.isOwner
      ? { kind: "route" as const, id: "route:billing", href: `${roomBase}/billing`, label: "Billing", Icon: CreditCard }
      : null,
  ].filter(Boolean) as NavItem[];

  const studioChild = (
    view: RoomStudioView,
    moduleKey: RoomModuleKey,
    fallbackLabel: string,
    Icon: LucideIcon
  ): FeatureNavItem | null => {
    const definition = moduleDefinitions.get(moduleKey);
    if (!definition) return null;
    const label = definition.label || fallbackLabel;
    return {
      kind: "feature",
      id: `workspace:studio:${view}`,
      label,
      Icon,
      feature: {
        id: `workspace:studio:${view}`,
        kind: "studio",
        label,
        initialView: view,
        hideNavigation: true,
      },
    };
  };

  const studioItems = [
    studioChild("tasks", "tasks", "Tasks", ListTodo),
    studioChild("polls", "polls", "Decisions", Vote),
    studioChild("forms", "forms", "Forms", ClipboardList),
    studioChild("knowledge", "knowledge", "Knowledge", BookOpen),
    studioChild("calendar", "calendar", "Calendar", CalendarDays),
    studioChild("files", "files", "Files", FolderLock),
    ORGANIZATION_PLAN_KEYS.has(plan.id)
      ? {
          kind: "feature" as const,
          id: "workspace:studio:organization",
          label: "Organization Console",
          Icon: Building2,
          feature: {
            id: "workspace:studio:organization",
            kind: "studio" as const,
            label: "Organization Console",
            initialView: "organization" as const,
            hideNavigation: true,
          },
        }
      : null,
  ].filter(Boolean) as NavItem[];

  const operationsChild = (
    view: RoomOperationsView,
    label: string,
    Icon: LucideIcon
  ): FeatureNavItem => ({
    kind: "feature",
    id: `workspace:operations:${view}`,
    label,
    Icon,
    feature: {
      id: `workspace:operations:${view}`,
      kind: "operations",
      label,
      initialView: view,
      hideNavigation: true,
    },
  });

  const operationsItems = [
    payload.access.canManage ? operationsChild("overview", "Overview", LayoutDashboard) : null,
    operationsChild("report", "Report", Flag),
    payload.access.canManage ? operationsChild("members", "Members", Users) : null,
    payload.access.canModerate ? operationsChild("moderation", "Moderation", ShieldCheck) : null,
    payload.access.isOwner ? operationsChild("lifecycle", "Lifecycle", FileClock) : null,
  ].filter(Boolean) as NavItem[];

  const secondaryConfig: Record<
    SecondaryRailKey,
    { title: string; eyebrow: string; description: string; items: NavItem[] }
  > = {
    settings: {
      title: "Settings",
      eyebrow: "Room administration",
      description: "Choose the Room setting you want to manage.",
      items: settingsItems,
    },
    studio: {
      title: "Room Studio",
      eyebrow: "Create and organize",
      description: "Open a Studio workspace for this Room.",
      items: studioItems,
    },
    operations: {
      title: "Room Operations",
      eyebrow: "Operate and protect",
      description: "Choose an authorized operational workspace.",
      items: operationsItems,
    },
  };

  const finishNavigation = () => {
    setSecondaryRail(null);
    setSidebarOpen(false);
  };

  const renderNavigation = (items: NavItem[]) =>
    items.map((item) => {
      const { id, label, Icon, badge } = item;
      if (item.kind === "group") {
        return (
          <button
            key={id}
            type="button"
            className="rooms-phase1-nav-link rooms-secondary-rail-trigger"
            aria-haspopup="menu"
            aria-expanded={secondaryRail === item.group}
            title={label}
            onClick={() => setSecondaryRail(item.group)}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
            {badge && badge > 0 ? <strong>{badge}</strong> : null}
            <ChevronRight className="rooms-secondary-rail-chevron" aria-hidden="true" />
          </button>
        );
      }
      if (item.kind === "route") {
        const active = routeIsActive(pathname, item.href, roomBase);
        return (
          <Link
            key={id}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="rooms-phase1-nav-link"
            title={label}
            onClick={() => {
              closeFeature({ restoreFocus: false });
              finishNavigation();
            }}
          >
            <Icon aria-hidden="true" /><span>{label}</span>
            {badge && badge > 0 ? <strong>{badge}</strong> : null}
          </Link>
        );
      }
      const active = activeFeature?.id === item.id;
      return (
        <button
          key={id}
          type="button"
          className="rooms-phase1-nav-link"
          data-feature-active={active ? "true" : "false"}
          aria-pressed={active}
          title={label}
          onClick={(event) => {
            openFeature(item.feature, event.currentTarget);
            finishNavigation();
          }}
        >
          <Icon aria-hidden="true" /><span>{label}</span>
          {badge && badge > 0 ? <strong>{badge}</strong> : null}
        </button>
      );
    });

  const activeSecondary = secondaryRail ? secondaryConfig[secondaryRail] : null;

  return (
    <div className="rooms-phase1-shell">
      <a href="#rooms-phase1-content" className="room-route-skip-link">Skip to Room content</a>
      <aside
        className="rooms-phase1-sidebar"
        data-open={sidebarOpen ? "true" : "false"}
        data-secondary-rail={secondaryRail ?? "main"}
        aria-label={activeSecondary ? `${activeSecondary.title} navigation` : "Room navigation"}
      >
        <div className="rooms-phase1-sidebar-head">
          <Link href="/home" className="rooms-phase1-brand" aria-label="Loombus home">
            <span className="rooms-phase1-brand-mark" aria-hidden="true"><img src="/assets/brand/loombus-mark-transparent.png" alt="" /></span>
            <span><strong>Loombus</strong><small>Rooms</small></span>
          </Link>
          <Link href="/rooms" className="rooms-phase1-all-rooms"><ArrowLeft aria-hidden="true" /> All Rooms</Link>
        </div>

        {activeSecondary ? (
          <div className="rooms-secondary-rail" role="menu" aria-label={activeSecondary.title}>
            <button
              type="button"
              className="rooms-secondary-rail-back"
              onClick={() => setSecondaryRail(null)}
            >
              <ArrowLeft aria-hidden="true" /> Room menu
            </button>
            <header className="rooms-secondary-rail-heading">
              <p>{activeSecondary.eyebrow}</p>
              <h2>{activeSecondary.title}</h2>
              <span>{activeSecondary.description}</span>
            </header>
            <nav className="rooms-secondary-rail-nav" aria-label={`${activeSecondary.title} destinations`}>
              {renderNavigation(activeSecondary.items)}
            </nav>
          </div>
        ) : (
          <>
            <section className="rooms-phase1-room-identity">
              <p>{profile.shortTitle}</p><h1>{payload.room.name}</h1>
              {payload.room.description ? <span>{payload.room.description}</span> : null}
              <div className="rooms-phase1-room-metrics" aria-label="Room summary">
                <span><strong>{payload.metrics.members}</strong>Members</span>
                <span><strong>{payload.metrics.discussions}</strong>Discussions</span>
                <span><strong>{payload.metrics.upcomingEvents}</strong>Upcoming</span>
                <span><strong>{payload.metrics.announcements}</strong>Updates</span>
              </div>
            </section>
            <div className="rooms-phase1-nav-scroll">
              {workspace.length ? <section className="rooms-phase1-nav-section"><p>Room</p><nav aria-label="Room workspace">{renderNavigation(workspace)}</nav></section> : null}
              {workAndResources.length ? <section className="rooms-phase1-nav-section"><p>Work & resources</p><nav aria-label="Room work and resources">{renderNavigation(workAndResources)}</nav></section> : null}
              <section className="rooms-phase1-nav-section"><p>Room tools</p><nav aria-label="Room tools">{renderNavigation(roomTools)}</nav></section>
              {management.length ? <section className="rooms-phase1-nav-section"><p>Management</p><nav aria-label="Room management">{renderNavigation(management)}</nav></section> : null}
            </div>
          </>
        )}

        <div className="rooms-phase1-sidebar-footer"><RoomsAppearanceControl /></div>
      </aside>
      <button
        type="button"
        className="rooms-phase1-sidebar-backdrop"
        data-open={sidebarOpen ? "true" : "false"}
        aria-label="Close Room navigation"
        onClick={closeSidebar}
      />
      <div className="rooms-phase1-main-column">
        <header className="rooms-phase1-room-header">
          <div className="rooms-phase1-room-header-main">
            <button
              type="button"
              className="rooms-phase1-menu-button"
              aria-label={sidebarOpen ? "Close Room navigation" : "Open Room navigation"}
              aria-expanded={sidebarOpen}
              onClick={() => {
                if (sidebarOpen) closeSidebar();
                else setSidebarOpen(true);
              }}
            >
              {sidebarOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
            <div className="rooms-phase1-room-header-copy"><strong>{payload.room.name}</strong><span>{roleLabel(payload.access.role)} · {plan.label}</span></div>
          </div>
          <div className="rooms-phase1-header-actions"><button type="button" className="rooms-phase1-refresh" onClick={() => void load(false)} disabled={refreshing}><RefreshCw aria-hidden="true" className={refreshing ? "is-spinning" : undefined} /><span>{refreshing ? "Refreshing" : "Refresh"}</span></button></div>
        </header>
        <div id="rooms-phase1-content" className="rooms-phase1-content">{children}</div>
      </div>
    </div>
  );
}
