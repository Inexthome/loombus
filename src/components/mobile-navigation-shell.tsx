"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  DoorOpen,
  Edit3,
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
  X,
  type LucideIcon,
} from "lucide-react";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
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

type MobileNavProfile = {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
};

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
  privacy: ShieldCheck,
  profile: UserCircle,
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

const primaryItems = [
  { href: "/discussions", label: "Discussions", icon: MessageCircle },
  { href: "/create", label: "Create", icon: Edit3 },
  { href: "/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/notifications", label: "Notifications", icon: Bell },
] as const;

function getDisplayName(profile: MobileNavProfile | null, email: string | null) {
  return (
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    email?.split("@")[0]?.trim() ||
    "Loombus member"
  );
}

function getInitial(profile: MobileNavProfile | null, email: string | null) {
  return getDisplayName(profile, email).charAt(0).toUpperCase();
}

function isPathActive(pathname: string, href: string) {
  if (href === "/discussions") {
    return pathname === href || pathname.startsWith("/discussions/");
  }

  if (href === "/rooms") {
    return pathname === href || pathname.startsWith("/rooms/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function MenuSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: readonly LoombusNavigationItem[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <section className="loombus-mobile-v2-menu-section">
      <p>{title}</p>
      <div>
        {items.map((item) => {
          const Icon = navigationIcons[item.icon];
          const active = isPathActive(pathname, item.href);

          return (
            <Link
              key={`${title}-${item.href}`}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              data-active={active ? "true" : "false"}
            >
              <Icon aria-hidden="true" size={17} strokeWidth={2.1} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function MobileNavigationShell() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<MobileNavProfile | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [activeMenu, setActiveMenu] = useState<"explore" | "account" | null>(null);
  const [topHidden, setTopHidden] = useState(false);
  const [bottomHidden, setBottomHidden] = useState(false);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);

  const profileHref = profile?.username ? `/u/${profile.username}` : "/profile";
  const profileItem = useMemo<LoombusNavigationItem>(
    () => ({
      href: profileHref,
      label: "Profile",
      description: "Open your public profile and identity settings.",
      icon: "profile",
    }),
    [profileHref]
  );

  function closeMenu() {
    setActiveMenu(null);
  }

  function openGlobalSearch() {
    closeMenu();
    window.dispatchEvent(new Event("loombus:open-global-search"));
  }

  async function handleLogout() {
    closeMenu();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  useEffect(() => {
    let mounted = true;
    let activeUserId: string | null = null;

    async function loadNavState(nextUserId: string) {
      const [{ data: profileData }, blockedIds] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, full_name, avatar_url, is_admin")
          .eq("id", nextUserId)
          .maybeSingle(),
        getBlockedRelationshipUserIds(supabase, nextUserId),
      ]);

      if (!mounted || activeUserId !== nextUserId) {
        return;
      }

      setProfile((profileData ?? null) as MobileNavProfile | null);

      const { data: notificationRows } = await supabase
        .from("notifications")
        .select("id, actor_id")
        .eq("user_id", nextUserId)
        .is("read_at", null);

      if (!mounted || activeUserId !== nextUserId) {
        return;
      }

      setNotificationCount(
        filterBlockedActorNotifications(notificationRows ?? [], blockedIds).length
      );
    }

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const nextUser = data.user ?? null;

      if (!mounted) {
        return;
      }

      activeUserId = nextUser?.id ?? null;
      setUserId(activeUserId);
      setEmail(nextUser?.email ?? null);

      if (!activeUserId) {
        setProfile(null);
        setNotificationCount(0);
        return;
      }

      await loadNavState(activeUserId);
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      activeUserId = nextUser?.id ?? null;
      setUserId(activeUserId);
      setEmail(nextUser?.email ?? null);

      if (!activeUserId) {
        setProfile(null);
        setNotificationCount(0);
        return;
      }

      void loadNavState(activeUserId);
    });

    function handleNotificationsChanged() {
      if (activeUserId) {
        void loadNavState(activeUserId);
      }
    }

    window.addEventListener("loombus:notifications-changed", handleNotificationsChanged);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("loombus:notifications-changed", handleNotificationsChanged);
    };
  }, []);

  useEffect(() => {
    closeMenu();
  }, [pathname]);

  useEffect(() => {
    if (!activeMenu) {
      delete document.body.dataset.loombusMobileMenuOpen;
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.dataset.loombusMobileMenuOpen = activeMenu;
    document.body.style.overflow = "hidden";
    setTopHidden(false);
    setBottomHidden(false);

    window.requestAnimationFrame(() => {
      menuPanelRef.current
        ?.querySelector<HTMLButtonElement>('[data-menu-close="true"]')
        ?.focus();
    });

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      delete document.body.dataset.loombusMobileMenuOpen;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activeMenu]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let lastScrollY = window.scrollY;
    let ticking = false;

    function updateVisibility() {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;

      if (activeMenu || currentScrollY < 80) {
        setTopHidden(false);
        setBottomHidden(false);
      } else if (delta > 8) {
        setTopHidden(true);
        setBottomHidden(true);
      } else if (delta < -8) {
        setTopHidden(false);
        setBottomHidden(false);
      }

      lastScrollY = currentScrollY;
      ticking = false;
    }

    function handleScroll() {
      if (!ticking) {
        window.requestAnimationFrame(updateVisibility);
        ticking = true;
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeMenu, userId]);

  if (!userId) {
    return null;
  }

  const displayName = getDisplayName(profile, email);
  const accountItems = [profileItem, ...ACCOUNT_NAVIGATION_SECTIONS[0].items];

  return (
    <>
      <header
        className={`loombus-mobile-v2-topbar ${topHidden ? "is-hidden" : ""}`}
        aria-label="Mobile Loombus navigation"
      >
        <div className="loombus-mobile-v2-topbar-inner">
          <button
            type="button"
            className="loombus-mobile-v2-brand"
            onClick={() => setActiveMenu((current) => (current === "explore" ? null : "explore"))}
            aria-label="Open Explore Loombus"
            aria-expanded={activeMenu === "explore"}
          >
            <span>
              <img src="/assets/brand/loombus-mark-transparent.png" alt="" />
            </span>
            <strong>Loombus</strong>
            <ChevronDown aria-hidden="true" size={16} strokeWidth={2.15} />
          </button>

          <div className="loombus-mobile-v2-top-actions">
            <button type="button" onClick={openGlobalSearch} aria-label="Search Loombus">
              <Search aria-hidden="true" size={21} strokeWidth={2.05} />
            </button>
            <button
              type="button"
              onClick={() => setActiveMenu((current) => (current === "account" ? null : "account"))}
              aria-label="Open account menu"
              aria-expanded={activeMenu === "account"}
              className="loombus-mobile-v2-avatar-button"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                <span>{getInitial(profile, email)}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {activeMenu ? (
        <div
          className="loombus-mobile-v2-menu-backdrop"
          data-menu-kind={activeMenu}
          onClick={closeMenu}
        >
          <div
            ref={menuPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label={activeMenu === "explore" ? "Explore Loombus" : "Loombus account menu"}
            className="loombus-mobile-v2-menu-panel"
            data-menu-kind={activeMenu}
            onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
          >
            <div className="loombus-mobile-v2-menu-header">
              {activeMenu === "explore" ? (
                <div className="loombus-mobile-v2-menu-title">
                  <span className="loombus-mobile-v2-menu-mark">
                    <img src="/assets/brand/loombus-mark-transparent.png" alt="" />
                  </span>
                  <div>
                    <strong>Explore Loombus</strong>
                    <span>Everything across the platform, organized by purpose.</span>
                  </div>
                </div>
              ) : (
                <div className="loombus-mobile-v2-menu-profile">
                  <span className="loombus-mobile-v2-menu-avatar">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" />
                    ) : (
                      getInitial(profile, email)
                    )}
                  </span>
                  <div>
                    <strong>{displayName}</strong>
                    <span>{profile?.username ? `@${profile.username}` : email}</span>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={closeMenu}
                aria-label={activeMenu === "explore" ? "Close Explore Loombus" : "Close account menu"}
                data-menu-close="true"
              >
                <X aria-hidden="true" size={19} />
              </button>
            </div>

            <div className="loombus-mobile-v2-menu-scroll">
              {activeMenu === "explore" ? (
                EXPLORE_NAVIGATION_SECTIONS.map((section) => (
                  <MenuSection
                    key={section.title}
                    title={section.title}
                    items={section.items}
                    pathname={pathname}
                    onNavigate={closeMenu}
                  />
                ))
              ) : (
                <>
                  <MenuSection
                    title="Your Account"
                    items={accountItems}
                    pathname={pathname}
                    onNavigate={closeMenu}
                  />

                  {ACCOUNT_NAVIGATION_SECTIONS.slice(1).map((section) => (
                    <MenuSection
                      key={section.title}
                      title={section.title}
                      items={section.items}
                      pathname={pathname}
                      onNavigate={closeMenu}
                    />
                  ))}

                  {profile?.is_admin ? (
                    <section className="loombus-mobile-v2-menu-section">
                      <p>Administration</p>
                      <div>
                        <Link
                          href="/admin"
                          onClick={closeMenu}
                          aria-current={isPathActive(pathname, "/admin") ? "page" : undefined}
                          data-active={isPathActive(pathname, "/admin") ? "true" : "false"}
                        >
                          <ShieldCheck aria-hidden="true" size={17} strokeWidth={2.1} />
                          <span>Admin</span>
                        </Link>
                      </div>
                    </section>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="loombus-mobile-v2-logout"
                  >
                    <LogOut aria-hidden="true" size={17} strokeWidth={2.1} />
                    <span>Logout</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Mobile primary navigation"
        className={`loombus-mobile-v2-bottom-nav ${bottomHidden ? "is-hidden" : ""}`}
      >
        <div>
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = isPathActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                data-active={active ? "true" : "false"}
              >
                <span className="loombus-mobile-v2-bottom-icon">
                  <Icon aria-hidden="true" size={25} strokeWidth={2.05} />
                  {item.href === "/notifications" && notificationCount > 0 ? (
                    <span className="loombus-mobile-v2-notification-badge">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  ) : null}
                </span>
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
