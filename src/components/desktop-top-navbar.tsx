"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Bookmark,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  Megaphone,
  Clock3,
  Compass,
  DoorOpen,
  Layers3,
  Network,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MapPin,
  MessageCircle,
  MessageSquareReply,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  StickyNote,
  Tags,
  UserCircle,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  ACCOUNT_NAVIGATION_SECTIONS,
  EXPLORE_NAVIGATION_SECTIONS,
  type LoombusNavigationIcon,
  type LoombusNavigationItem,
} from "@/lib/loombus-navigation";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";
import { supabase } from "@/lib/supabase/client";

type DesktopTopNavProfile = {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
};

const centerLinks = [
  { href: "/discussions", label: "Discussions" },
  { href: "/create", label: "Create" },
  { href: "/rooms", label: "Rooms" },
];

const navigationIcons: Record<LoombusNavigationIcon, LucideIcon> = {
  activity: Activity,
  appointments: CalendarDays,
  businesses: Building2,
  calendar: CalendarDays,
  dashboard: LayoutDashboard,
  events: CalendarDays,
  following: Activity,
  guide: BookOpen,
  history: Clock3,
  home: Home,
  jobs: BriefcaseBusiness,
  labs: Sparkles,
  local: MapPin,
  marketplace: ShoppingBag,
  matches: Network,
  messages: MessageCircle,
  "my-discussions": MessageCircle,
  "my-replies": MessageSquareReply,
  people: Users,
  premium: Sparkles,
  profile: UserCircle,
  privacy: ShieldCheck,
  requests: Megaphone,
  rooms: DoorOpen,
  saved: Bookmark,
  search: Search,
  services: Wrench,
  settings: Settings,
  "signal-board": StickyNote,
  support: LifeBuoy,
  topics: Tags,
  usage: Bot,
};

function getInitial(profile: DesktopTopNavProfile | null, email: string | null) {
  return (
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    email?.split("@")[0]?.trim() ||
    "U"
  )
    .charAt(0)
    .toUpperCase();
}

function getDisplayName(profile: DesktopTopNavProfile | null, email: string | null) {
  return (
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    email?.split("@")[0]?.trim() ||
    "Loombus member"
  );
}

function isPathActive(pathname: string, href: string) {
  if (href === "/rooms") {
    return pathname === "/rooms" || pathname.startsWith("/rooms/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function CompactMenuLink({
  item,
  active,
}: {
  item: LoombusNavigationItem;
  active: boolean;
}) {
  const Icon = navigationIcons[item.icon];

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm transition ${
        active
          ? "bg-[var(--loombus-gold-surface)] text-[var(--loombus-text)]"
          : "text-[var(--loombus-text-muted)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
      }`}
    >
      <Icon
        aria-hidden="true"
        className={active ? "h-4 w-4 text-[var(--loombus-gold)]" : "h-4 w-4"}
        strokeWidth={2.1}
      />
      {item.label}
    </Link>
  );
}

function CompactMenuSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: readonly LoombusNavigationItem[];
  pathname: string;
}) {
  return (
    <section className="py-2">
      <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--loombus-gold)]">
        {title}
      </p>
      <div className="grid gap-0.5">
        {items.map((item) => (
          <CompactMenuLink
            key={`${item.href}-${item.label}`}
            item={item}
            active={isPathActive(pathname, item.href)}
          />
        ))}
      </div>
    </section>
  );
}

function ExploreLink({
  item,
  pathname,
}: {
  item: LoombusNavigationItem;
  pathname: string;
}) {
  const Icon = navigationIcons[item.icon];
  const active = isPathActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group flex min-h-[5.5rem] items-start gap-3 rounded-[1.35rem] border p-3.5 transition ${
        active
          ? "border-[color:color-mix(in_srgb,var(--loombus-gold)_45%,var(--loombus-border))] bg-[var(--loombus-gold-surface)]"
          : "border-transparent hover:border-[var(--loombus-border)] hover:bg-[var(--loombus-surface-muted)]"
      }`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${
          active
            ? "border-[color:color-mix(in_srgb,var(--loombus-gold)_45%,var(--loombus-border))] bg-[var(--loombus-surface)] text-[var(--loombus-gold)]"
            : "border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] text-[var(--loombus-text-muted)] group-hover:text-[var(--loombus-text)]"
        }`}
      >
        <Icon aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.05} />
      </span>
      <span className="min-w-0">
        <strong className="block text-sm font-semibold text-[var(--loombus-text)]">
          {item.label}
        </strong>
        <span className="mt-1 block text-xs leading-5 text-[var(--loombus-text-muted)]">
          {item.description}
        </span>
      </span>
    </Link>
  );
}

export function DesktopTopNavbar() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<DesktopTopNavProfile | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const exploreRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadNavState(nextUserId: string) {
      const [{ data: profileData }, blockedIds] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, full_name, avatar_url, is_admin")
          .eq("id", nextUserId)
          .maybeSingle(),
        getBlockedRelationshipUserIds(supabase, nextUserId),
      ]);

      if (!isMounted) {
        return;
      }

      setProfile((profileData ?? null) as DesktopTopNavProfile | null);

      const { data: notificationRows } = await supabase
        .from("notifications")
        .select("id, actor_id")
        .eq("user_id", nextUserId)
        .is("read_at", null);

      if (isMounted) {
        setNotificationCount(
          filterBlockedActorNotifications(notificationRows ?? [], blockedIds).length
        );
      }
    }

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const nextUser = data.user ?? null;

      if (!isMounted) {
        return;
      }

      setUserId(nextUser?.id ?? null);
      setEmail(nextUser?.email ?? null);

      if (!nextUser?.id) {
        setProfile(null);
        setNotificationCount(0);
        return;
      }

      await loadNavState(nextUser.id);
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      const nextUserId = nextUser?.id ?? null;

      setUserId(nextUserId);
      setEmail(nextUser?.email ?? null);

      if (!nextUserId) {
        setProfile(null);
        setNotificationCount(0);
        return;
      }

      void loadNavState(nextUserId);
    });

    function handleNotificationsChanged() {
      if (userId) {
        void loadNavState(userId);
      }
    }

    window.addEventListener("loombus:notifications-changed", handleNotificationsChanged);

    return () => {
      isMounted = false;
      window.removeEventListener("loombus:notifications-changed", handleNotificationsChanged);
      subscription.unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      if (!exploreRef.current?.contains(target)) {
        setExploreOpen(false);
      }

      if (!profileRef.current?.contains(target)) {
        setProfileOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExploreOpen(false);
        setProfileOpen(false);
      }
    }

    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    setExploreOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (!userId) {
    return null;
  }

  const displayName = getDisplayName(profile, email);
  const profileHref = profile?.username ? `/u/${profile.username}` : "/profile";
  const profileItem: LoombusNavigationItem = {
    href: profileHref,
    label: "Profile",
    description: "Open your public profile and identity settings.",
    icon: "profile",
  };

  return (
    <header className="loombus-desktop-top-navbar fixed inset-x-0 top-0 z-[65] hidden h-[72px] border-b border-[var(--loombus-border)] bg-[var(--loombus-surface)]/92 text-[var(--loombus-text)] shadow-xl shadow-black/5 backdrop-blur-xl md:block">
      <div className="mx-auto grid h-full max-w-[92rem] grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 lg:px-8">
        <Link
          href="/home"
          aria-label="Loombus home"
          className="flex min-w-0 items-center gap-3 justify-self-start rounded-full pr-3 transition hover:opacity-85"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)]">
            <img
              src="/assets/brand/loombus-mark-transparent.png"
              alt=""
              className="h-7 w-7 object-contain"
            />
          </span>
          <span className="text-lg font-semibold tracking-tight">Loombus</span>
        </Link>

        <nav
          aria-label="Desktop primary navigation"
          className="flex items-center justify-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-1"
        >
          {centerLinks.map((link) => {
            const active = isPathActive(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)] shadow-sm shadow-black/10"
                    : "text-[var(--loombus-text-muted)] hover:bg-[var(--loombus-surface-strong)] hover:text-[var(--loombus-text)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <div ref={exploreRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setExploreOpen((current) => !current);
                setProfileOpen(false);
              }}
              aria-label="Explore Loombus"
              aria-expanded={exploreOpen}
              aria-controls="loombus-desktop-explore-menu"
              className="flex h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 text-sm font-semibold text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
            >
              <Layers3 aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
              <span className="hidden lg:inline">Explore Loombus</span>
              <ChevronDown
                aria-hidden="true"
                className={`hidden h-4 w-4 transition-transform lg:block ${
                  exploreOpen ? "rotate-180" : ""
                }`}
                strokeWidth={2.1}
              />
            </button>

            {exploreOpen && (
              <div
                id="loombus-desktop-explore-menu"
                role="dialog"
                aria-label="Explore Loombus"
                className="fixed left-1/2 top-[5.25rem] w-[calc(100vw-3rem)] max-w-[56rem] -translate-x-1/2 overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text)] shadow-2xl shadow-black/20"
              >
                <div className="flex items-center justify-between gap-4 border-b border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[color:color-mix(in_srgb,var(--loombus-gold)_35%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
                      <Compass aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Explore Loombus</p>
                      <p className="mt-0.5 text-xs text-[var(--loombus-text-muted)]">
                        Move between knowledge, local opportunities, and the tools that organize your activity.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/search"
                    className="hidden shrink-0 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-xs font-semibold text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-gold)] hover:text-[var(--loombus-text)] sm:inline-flex"
                  >
                    Search Everything
                  </Link>
                </div>

                <div className="grid max-h-[calc(100vh-8.5rem)] gap-3 overflow-y-auto p-4 lg:grid-cols-3">
                  {EXPLORE_NAVIGATION_SECTIONS.map((section) => (
                    <section
                      key={section.title}
                      className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-2"
                    >
                      <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">
                        {section.title}
                      </p>
                      <div className="grid gap-1">
                        {section.items.map((item) => (
                          <ExploreLink key={item.href} item={item} pathname={pathname} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link
            href="/search"
            aria-label="Search Loombus"
            title="Search"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
          >
            <Search aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
          </Link>

          <Link
            href="/notifications"
            aria-label="Notifications"
            title="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
          >
            <Bell aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
            {notificationCount > 0 && (
              <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[var(--loombus-primary-bg)] px-1 text-[10px] font-bold text-[var(--loombus-primary-text)] ring-2 ring-[var(--loombus-surface)]">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </Link>

          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((current) => !current);
                setExploreOpen(false);
              }}
              aria-label="Open account menu"
              aria-expanded={profileOpen}
              className="flex h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] py-1 pl-1 pr-3 text-[var(--loombus-text)] transition hover:border-[var(--loombus-text-subtle)]"
            >
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] text-sm font-semibold">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>{getInitial(profile, email)}</span>
                )}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 text-[var(--loombus-text-muted)] transition-transform ${
                  profileOpen ? "rotate-180" : ""
                }`}
                strokeWidth={2.1}
              />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-3 flex max-h-[calc(100vh-6rem)] w-80 flex-col overflow-hidden rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text)] shadow-2xl shadow-black/15">
                <div className="shrink-0 border-b border-[var(--loombus-border)] px-4 py-3">
                  <p className="truncate text-sm font-semibold">{displayName}</p>
                  <p className="mt-1 truncate text-xs text-[var(--loombus-text-muted)]">
                    {profile?.username ? `@${profile.username}` : email ?? "Loombus account"}
                  </p>
                </div>

                <div className="min-h-0 overflow-y-auto p-2">
                  <section className="py-2">
                    <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--loombus-gold)]">
                      Your Account
                    </p>
                    <div className="grid gap-0.5">
                      <CompactMenuLink
                        item={profileItem}
                        active={isPathActive(pathname, profileItem.href)}
                      />
                      {ACCOUNT_NAVIGATION_SECTIONS[0].items.map((item) => (
                        <CompactMenuLink
                          key={item.href}
                          item={item}
                          active={isPathActive(pathname, item.href)}
                        />
                      ))}
                    </div>
                  </section>

                  {ACCOUNT_NAVIGATION_SECTIONS.slice(1).map((section) => (
                    <CompactMenuSection
                      key={section.title}
                      title={section.title}
                      items={section.items}
                      pathname={pathname}
                    />
                  ))}

                  {profile?.is_admin && (
                    <section className="border-t border-[var(--loombus-border)] py-2">
                      <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--loombus-gold)]">
                        Administration
                      </p>
                      <CompactMenuLink
                        item={{
                          href: "/admin",
                          label: "Admin",
                          description: "Open Loombus administration.",
                          icon: "privacy",
                        }}
                        active={isPathActive(pathname, "/admin")}
                      />
                    </section>
                  )}

                  <div className="border-t border-[var(--loombus-border)] pt-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm text-[var(--loombus-text-muted)] transition hover:bg-red-500/10 hover:text-red-500"
                    >
                      <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
