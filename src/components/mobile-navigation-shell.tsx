"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Bookmark,
  Bot,
  Clock3,
  DoorOpen,
  Edit3,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MessageSquareReply,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Tags,
  UserCircle,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const discoveryItems: MenuItem[] = [
  { href: "/home", label: "Home", icon: Sparkles },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/onboarding", label: "Onboarding", icon: Sparkles },
  { href: "/topics", label: "Signal Topics", icon: Tags },
  { href: "/people", label: "People", icon: Users },
  { href: "/following", label: "Following", icon: Activity },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/stickies", label: "Signal Board", icon: StickyNote },
];

const activityItems: MenuItem[] = [
  { href: "/my-activity", label: "My Activity", icon: Activity },
  { href: "/my-discussions", label: "My Discussions", icon: MessageCircle },
  { href: "/my-replies", label: "My Replies", icon: MessageSquareReply },
  { href: "/reading-history", label: "Reading History", icon: Clock3 },
];

const buildItems: MenuItem[] = [
  { href: "/labs", label: "Labs", icon: Sparkles },
  { href: "/premium", label: "Premium", icon: Sparkles },
  { href: "/ai-usage", label: "AI Usage", icon: Bot },
];

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

function MenuSection({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: MenuItem[];
  onNavigate: () => void;
}) {
  return (
    <section className="loombus-mobile-v2-menu-section">
      <p>{title}</p>
      <div>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={`${title}-${item.href}`} href={item.href} onClick={onNavigate}>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [topHidden, setTopHidden] = useState(false);
  const [bottomHidden, setBottomHidden] = useState(false);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);

  const profileHref = profile?.username ? `/u/${profile.username}` : "/profile";
  const accountItems = useMemo<MenuItem[]>(
    () => [
      { href: profileHref, label: "Profile", icon: UserCircle },
      { href: "/privacy-security", label: "Privacy & Security", icon: ShieldCheck },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
    [profileHref]
  );

  function isActivePath(href: string) {
    if (href === "/discussions") {
      return pathname === href || pathname.startsWith("/discussions/");
    }

    if (href === "/rooms") {
      return pathname === href || pathname.startsWith("/rooms/");
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function openExistingGlobalSearch() {
    closeMenu();
    const existingSearchButton = document.querySelector<HTMLButtonElement>(
      '.loombus-mobile-topbar button[aria-label="Search Loombus"]'
    );

    if (existingSearchButton) {
      existingSearchButton.click();
      return;
    }

    window.location.href = "/search";
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

      if (!mounted || activeUserId !== nextUserId) return;

      setProfile((profileData ?? null) as MobileNavProfile | null);

      const { data: notificationRows } = await supabase
        .from("notifications")
        .select("id, actor_id")
        .eq("user_id", nextUserId)
        .is("read_at", null);

      if (!mounted || activeUserId !== nextUserId) return;

      setNotificationCount(
        filterBlockedActorNotifications(notificationRows ?? [], blockedIds).length
      );
    }

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const nextUser = data.user ?? null;

      if (!mounted) return;

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
      if (activeUserId) void loadNavState(activeUserId);
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
    if (!menuOpen) {
      delete document.body.dataset.loombusMobileMenuOpen;
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.dataset.loombusMobileMenuOpen = "true";
    document.body.style.overflow = "hidden";
    setTopHidden(false);
    setBottomHidden(false);

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      delete document.body.dataset.loombusMobileMenuOpen;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!userId) return;

    let lastScrollY = window.scrollY;
    let ticking = false;

    function updateVisibility() {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;

      if (menuOpen || currentScrollY < 80) {
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
  }, [menuOpen, userId]);

  if (!userId) return null;

  const displayName = getDisplayName(profile, email);

  return (
    <>
      <header
        className={`loombus-mobile-v2-topbar ${topHidden ? "is-hidden" : ""}`}
        aria-label="Mobile Loombus navigation"
      >
        <div className="loombus-mobile-v2-topbar-inner">
          <Link href="/home" className="loombus-mobile-v2-brand" aria-label="Loombus home">
            <span>
              <img src="/assets/brand/loombus-mark-transparent.png" alt="" />
            </span>
            <strong>Loombus</strong>
          </Link>

          <div className="loombus-mobile-v2-top-actions">
            <button type="button" onClick={openExistingGlobalSearch} aria-label="Search Loombus">
              <Search aria-hidden="true" size={21} strokeWidth={2.05} />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label="Open profile menu"
              aria-expanded={menuOpen}
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

      {menuOpen ? (
        <div className="loombus-mobile-v2-menu-backdrop" onClick={closeMenu}>
          <div
            ref={menuPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Profile navigation menu"
            className="loombus-mobile-v2-menu-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="loombus-mobile-v2-menu-header">
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
              <button type="button" onClick={closeMenu} aria-label="Close profile menu">
                <X aria-hidden="true" size={19} />
              </button>
            </div>

            <div className="loombus-mobile-v2-menu-scroll">
              <MenuSection title="Discover" items={discoveryItems} onNavigate={closeMenu} />
              <MenuSection title="Activity" items={activityItems} onNavigate={closeMenu} />
              <MenuSection title="Build" items={buildItems} onNavigate={closeMenu} />
              <MenuSection title="Account" items={accountItems} onNavigate={closeMenu} />

              {profile?.is_admin ? (
                <section className="loombus-mobile-v2-menu-section">
                  <p>Administration</p>
                  <div>
                    <Link href="/admin" onClick={closeMenu}>
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
            const active = isActivePath(item.href);
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
