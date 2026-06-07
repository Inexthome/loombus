"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Bookmark,
  Edit3,
  Home,
  LayoutDashboard,
  LogOut,
  FlaskConical,
  Menu,
  MessageCircle,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  UserCircle,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";

type NavProfile = {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
};

const RIGHT_RAIL_WIDTH_STORAGE_KEY = "loombus:right-rail-width";

type DiscussionFeedMode = "all" | "following" | "signal";
const DEFAULT_RIGHT_RAIL_WIDTH = 320;
const MIN_RIGHT_RAIL_WIDTH = 280;
const MAX_RIGHT_RAIL_WIDTH = 480;

function clampRightRailWidth(width: number) {
  return Math.min(MAX_RIGHT_RAIL_WIDTH, Math.max(MIN_RIGHT_RAIL_WIDTH, width));
}

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, setUser] = useState<any>(null);
  const [navProfile, setNavProfile] = useState<NavProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [bottomNavHidden, setBottomNavHidden] = useState(false);
  const [topNavHidden, setTopNavHidden] = useState(false);
  const [rightRailWidth, setRightRailWidth] = useState(DEFAULT_RIGHT_RAIL_WIDTH);
  const [rightRailResizing, setRightRailResizing] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const loadingNotificationCountRef = useRef(false);
  const lastNotificationLoadRef = useRef<{ userId: string; loadedAt: number } | null>(null);
  const rightRailDragStartRef = useRef<{ pointerX: number; width: number } | null>(null);
  const pathname = usePathname();
  const isDiscussionsIndex = pathname === "/discussions";
  const [mobileDiscussionFeed, setMobileDiscussionFeed] =
    useState<DiscussionFeedMode>("all");
  const hasDesktopRightRail =
    [
      "/discussions",
      "/search",
      "/people",
      "/saved",
      "/notifications",
      "/create",
    ].includes(pathname) || pathname.startsWith("/discussions/");

  function isActivePath(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function navLinkClass(href: string) {
    return isActivePath(href)
      ? "text-white transition hover:text-white"
      : "transition hover:text-white";
  }

  function mobileNavLinkClass(href: string) {
    return isActivePath(href)
      ? "loombus-mobile-menu-link-active rounded-2xl border px-4 py-3 text-sm font-medium transition"
      : "loombus-mobile-menu-link-inactive rounded-2xl border px-4 py-3 text-sm font-medium transition";
  }

  function appTabClass(href: string) {
    const active =
      pathname === href || (href !== "/" && pathname.startsWith(href));

    return `flex min-w-0 items-center justify-center rounded-[1.1rem] border px-2 py-3 transition ${
      active
        ? "loombus-mobile-bottom-tab-active"
        : "loombus-mobile-bottom-tab-inactive"
    }`;
  }

  function desktopRailLinkClass(href: string, emphasis = false) {
    const active = isActivePath(href);

    if (emphasis) {
      return active
        ? "group relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black shadow-2xl shadow-white/10 transition"
        : "group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-300 transition hover:border-zinc-600 hover:text-white";
    }

    return active
      ? "group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900 text-white shadow-xl shadow-black/20 transition"
      : "group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-transparent text-zinc-500 transition hover:border-zinc-800 hover:bg-zinc-950 hover:text-white";
  }

  function DesktopRailTooltip({ label }: { label: string }) {
    return (
      <span className="pointer-events-none absolute left-[3.65rem] z-50 whitespace-nowrap rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 opacity-0 shadow-2xl transition group-hover:opacity-100">
        {label}
      </span>
    );
  }

  function appMenuButtonClass() {
    return `flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2.5 text-[11px] font-medium transition ${
      mobileMenuOpen
        ? "border-white bg-white text-black shadow-lg shadow-white/10"
        : "border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-950 hover:text-white"
    }`;
  }

  function MobileNavIcon({ name }: { name: "home" | "discuss" | "create" | "people" | "alerts" }) {
    const iconClass = "h-[1.35rem] w-[1.35rem]";
    const strokeWidth = 2.05;

    if (name === "home") {
      return <Home aria-hidden="true" className={iconClass} strokeWidth={strokeWidth} />;
    }

    if (name === "discuss") {
      return <MessageCircle aria-hidden="true" className={iconClass} strokeWidth={strokeWidth} />;
    }

    if (name === "create") {
      return <Edit3 aria-hidden="true" className={iconClass} strokeWidth={strokeWidth} />;
    }

    if (name === "people") {
      return <Users aria-hidden="true" className={iconClass} strokeWidth={strokeWidth} />;
    }

    return <Bell aria-hidden="true" className={iconClass} strokeWidth={strokeWidth} />;
  }

  async function loadNotificationCount(
    userId: string,
    options: { force?: boolean } = {}
  ) {
    const now = Date.now();
    const recentLoad = lastNotificationLoadRef.current;

    if (
      !options.force &&
      recentLoad?.userId === userId &&
      now - recentLoad.loadedAt < 3000
    ) {
      return;
    }

    if (loadingNotificationCountRef.current) {
      return;
    }

    loadingNotificationCountRef.current = true;

    try {
      const blockedRelationshipUserIds = await getBlockedRelationshipUserIds(
        supabase,
        userId
      );

      const { data } = await supabase
        .from("notifications")
        .select("id, actor_id")
        .eq("user_id", userId)
        .is("read_at", null);

      setNotificationCount(
        filterBlockedActorNotifications(data ?? [], blockedRelationshipUserIds).length
      );

      lastNotificationLoadRef.current = {
        userId,
        loadedAt: Date.now(),
      };
    } finally {
      loadingNotificationCountRef.current = false;
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadAdminStatus(userId: string) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, full_name, avatar_url, is_admin")
          .eq("id", userId)
          .single();

        if (isMounted && currentUserIdRef.current === userId) {
          setNavProfile((profile ?? null) as NavProfile | null);
          setIsAdmin(Boolean(profile?.is_admin));
        }
      } catch (error) {
        console.error("Unable to load admin status.", error);

        if (isMounted && currentUserIdRef.current === userId) {
          setIsAdmin(false);
        }
      }
    }

    async function refreshAuthenticatedNavState(
      userId: string,
      options: { forceNotifications?: boolean } = {}
    ) {
      await Promise.allSettled([
        loadNotificationCount(userId, {
          force: Boolean(options.forceNotifications),
        }),
        loadAdminStatus(userId),
      ]);
    }

    async function loadUser() {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id ?? null;

        if (!isMounted) {
          return;
        }

        currentUserIdRef.current = userId;
        setUser(data.user ?? null);

        if (!userId) {
          setNotificationCount(0);
          setNavProfile(null);
          setIsAdmin(false);
          lastNotificationLoadRef.current = null;
          return;
        }

        await refreshAuthenticatedNavState(userId);
      } catch (error) {
        console.error("Unable to load layout auth state.", error);

        if (isMounted) {
          currentUserIdRef.current = null;
          setUser(null);
          setNotificationCount(0);
          setNavProfile(null);
          setIsAdmin(false);
          lastNotificationLoadRef.current = null;
        }
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      const previousUserId = currentUserIdRef.current;

      currentUserIdRef.current = nextUserId;
      setUser(session?.user ?? null);

      if (!nextUserId) {
        setNotificationCount(0);
        setIsAdmin(false);
        lastNotificationLoadRef.current = null;
        return;
      }

      if (nextUserId !== previousUserId) {
        setTimeout(() => {
          void refreshAuthenticatedNavState(nextUserId, {
            forceNotifications: true,
          });
        }, 0);
      }
    });

    function handleNotificationsChanged() {
      const userId = currentUserIdRef.current;

      if (userId) {
        setTimeout(() => {
          void loadNotificationCount(userId, { force: true });
        }, 0);
      } else {
        setNotificationCount(0);
      }
    }

    window.addEventListener(
      "loombus:notifications-changed",
      handleNotificationsChanged
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        "loombus:notifications-changed",
        handleNotificationsChanged
      );
      subscription.unsubscribe();
    };
  }, []);

  function selectMobileDiscussionFeed(feed: DiscussionFeedMode) {
    setMobileDiscussionFeed(feed);

    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (feed === "all") {
      params.delete("feed");
    } else {
      params.set("feed", feed);
    }

    params.delete("topic");
    params.delete("purpose");

    const queryString = params.toString();
    const nextUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState(null, "", nextUrl);

    window.dispatchEvent(
      new CustomEvent("loombus:discussion-feed", {
        detail: { feed },
      })
    );
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function closeMoreMenu() {
    setMoreMenuOpen(false);
  }

  useEffect(() => {
    const storedWidth = Number(window.localStorage.getItem(RIGHT_RAIL_WIDTH_STORAGE_KEY));

    if (Number.isFinite(storedWidth) && storedWidth > 0) {
      setRightRailWidth(clampRightRailWidth(storedWidth));
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--loombus-right-rail-width",
      `${rightRailWidth}px`
    );

    window.localStorage.setItem(
      RIGHT_RAIL_WIDTH_STORAGE_KEY,
      String(rightRailWidth)
    );
  }, [rightRailWidth]);

  function startRightRailResize(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();

    rightRailDragStartRef.current = {
      pointerX: event.clientX,
      width: rightRailWidth,
    };

    setRightRailResizing(true);
  }

  function adjustRightRailWidth(delta: number) {
    setRightRailWidth((current) => clampRightRailWidth(current + delta));
  }

  useEffect(() => {
    if (!rightRailResizing) {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      const dragStart = rightRailDragStartRef.current;

      if (!dragStart) {
        return;
      }

      const delta = dragStart.pointerX - event.clientX;
      setRightRailWidth(clampRightRailWidth(dragStart.width + delta));
    }

    function handleMouseUp() {
      rightRailDragStartRef.current = null;
      setRightRailResizing(false);
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [rightRailResizing]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!user) {
      setBottomNavHidden(false);
      return;
    }

    function getScrollY() {
      return (
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      );
    }

    let lastScrollY = getScrollY();
    let touchStartY: number | null = null;
    let ticking = false;

    function setNavVisibilityFromDelta(currentScrollY: number, scrollDelta: number) {
      if (mobileMenuOpen || currentScrollY < 80) {
        setTopNavHidden(false);
        setBottomNavHidden(false);
        return;
      }

      if (scrollDelta > 8) {
        setTopNavHidden(true);
        setBottomNavHidden(true);
      } else if (scrollDelta < -8) {
        setTopNavHidden(false);
        setBottomNavHidden(false);
      }
    }

    function updateBottomNavVisibility() {
      const currentScrollY = getScrollY();
      const scrollDelta = currentScrollY - lastScrollY;

      setNavVisibilityFromDelta(currentScrollY, scrollDelta);

      lastScrollY = currentScrollY;
      ticking = false;
    }

    function handleScroll() {
      if (!ticking) {
        window.requestAnimationFrame(updateBottomNavVisibility);
        ticking = true;
      }
    }

    function handleTouchStart(event: TouchEvent) {
      touchStartY = event.touches[0]?.clientY ?? null;
    }

    function handleTouchMove(event: TouchEvent) {
      if (touchStartY === null) {
        return;
      }

      const currentTouchY = event.touches[0]?.clientY ?? touchStartY;
      const touchDelta = touchStartY - currentTouchY;
      const currentScrollY = getScrollY();

      setNavVisibilityFromDelta(currentScrollY, touchDelta);
    }

    function handleTouchEnd() {
      lastScrollY = getScrollY();
      touchStartY = null;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [mobileMenuOpen, user]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!moreMenuRef.current) {
        return;
      }

      if (!moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handleOutsideClick);

    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      {/* Desktop Signal Rail: U2 app-shell foundation. Mobile keeps the existing floating top/bottom shell. */}
      {user && (
        <aside className="loombus-desktop-rail fixed inset-y-0 left-0 z-40 hidden w-24 border-r border-zinc-900 bg-black/95 px-3 py-4 backdrop-blur-xl md:flex md:flex-col md:items-center">
          <Link
            href="/"
            aria-label="Loombus home"
            title="Loombus"
            className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-900 bg-zinc-950 transition hover:border-zinc-700"
          >
            <img
              src="/assets/brand/loombus-mark-transparent.png"
              alt=""
              className="h-9 w-9 object-contain"
            />
          </Link>

          <nav aria-label="Primary desktop navigation" className="flex flex-1 flex-col items-center gap-2">
            <Link href="/" aria-label="Home" title="Home" aria-current={isActivePath("/") ? "page" : undefined} data-active={isActivePath("/") ? "true" : undefined} className={desktopRailLinkClass("/")}>
              <Home aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Home" />
            </Link>

            <Link href="/discussions" aria-label="Discussions" title="Discussions" aria-current={isActivePath("/discussions") ? "page" : undefined} data-active={isActivePath("/discussions") ? "true" : undefined} className={desktopRailLinkClass("/discussions", true)}>
              <MessageCircle aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Discussions" />
            </Link>

            <Link href="/create" aria-label="Create" title="Create" aria-current={isActivePath("/create") ? "page" : undefined} data-active={isActivePath("/create") ? "true" : undefined} className={desktopRailLinkClass("/create", true)}>
              <Edit3 aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Create" />
            </Link>

            <Link href="/search" aria-label="Search" title="Search" aria-current={isActivePath("/search") ? "page" : undefined} data-active={isActivePath("/search") ? "true" : undefined} className={desktopRailLinkClass("/search")}>
              <Search aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Search" />
            </Link>

            <Link href="/people" aria-label="People" title="People" aria-current={isActivePath("/people") ? "page" : undefined} data-active={isActivePath("/people") ? "true" : undefined} className={desktopRailLinkClass("/people")}>
              <Users aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="People" />
            </Link>

            <Link href="/messages" aria-label="Messages" title="Messages" aria-current={isActivePath("/messages") ? "page" : undefined} data-active={isActivePath("/messages") ? "true" : undefined} className={desktopRailLinkClass("/messages")}>
              <MessageCircle aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Messages" />
            </Link>

            <Link href="/saved" aria-label="Saved" title="Saved" aria-current={isActivePath("/saved") ? "page" : undefined} data-active={isActivePath("/saved") ? "true" : undefined} className={desktopRailLinkClass("/saved")}>
              <Bookmark aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Saved" />
            </Link>

            <Link href="/notifications" aria-label="Alerts" title="Alerts" aria-current={isActivePath("/notifications") ? "page" : undefined} data-active={isActivePath("/notifications") ? "true" : undefined} className={desktopRailLinkClass("/notifications")}>
              <span className="relative">
                <Bell aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
                {notificationCount > 0 && (
                  <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-white px-1 text-center text-[9px] font-semibold leading-4 text-black">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </span>
              <DesktopRailTooltip label="Alerts" />
            </Link>
          </nav>

          <div className="flex flex-col items-center gap-2">
            <Link href="/dashboard" aria-label="Home status" title="Home status" aria-current={isActivePath("/dashboard") ? "page" : undefined} data-active={isActivePath("/dashboard") ? "true" : undefined} className={desktopRailLinkClass("/dashboard")}>
              <LayoutDashboard aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Home status" />
            </Link>

            <Link href="/profile" aria-label="Profile" title="Profile" aria-current={isActivePath("/profile") ? "page" : undefined} data-active={isActivePath("/profile") ? "true" : undefined} className={desktopRailLinkClass("/profile")}>
              <UserCircle aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Profile" />
            </Link>

            <Link href="/labs" aria-label="Labs" title="Labs" aria-current={isActivePath("/labs") ? "page" : undefined} data-active={isActivePath("/labs") ? "true" : undefined} className={desktopRailLinkClass("/labs")}>
              <FlaskConical aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Labs" />
            </Link>

            {isAdmin && (
              <Link href="/admin" aria-label="Admin" title="Admin" aria-current={isActivePath("/admin") ? "page" : undefined} data-active={isActivePath("/admin") ? "true" : undefined} className={desktopRailLinkClass("/admin")}>
                <ShieldCheck aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
                <DesktopRailTooltip label="Admin" />
              </Link>
            )}

            <Link href="/settings" aria-label="Settings" title="Settings" aria-current={isActivePath("/settings") ? "page" : undefined} data-active={isActivePath("/settings") ? "true" : undefined} className={desktopRailLinkClass("/settings")}>
              <SettingsIcon aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Settings" />
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
              title="Logout"
              className="group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-transparent text-zinc-600 transition hover:border-red-950 hover:bg-red-950/20 hover:text-red-300"
            >
              <LogOut aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              <DesktopRailTooltip label="Logout" />
            </button>
          </div>
        </aside>
      )}
      {user && (
        <header className="hidden">
          <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-5">
            <div className="flex items-center justify-between gap-4">
              <Link
                href="/"
                className="flex items-center gap-3 text-xl font-semibold tracking-tight"
                aria-label="Loombus home"
              >
                <img
                  src="/assets/brand/loombus-mark-transparent.png"
                  alt=""
                  className="h-7 w-7 object-contain sm:h-8 sm:w-8"
                />
                <span className="text-lg sm:text-xl">Loombus</span>
              </Link>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle navigation menu"
                className="hidden rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white md:hidden"
              >
                Menu
              </button>

              <nav className="hidden items-center gap-5 text-sm text-zinc-400 md:flex">
                <Link href="/" onClick={closeMoreMenu} className={navLinkClass("/")}>
                  Home
                </Link>

                <Link
                  href="/create"
                  onClick={closeMoreMenu}
                  className="rounded-full bg-white px-4 py-2 font-medium text-black transition hover:bg-zinc-200"
                >
                  Create
                </Link>

                <Link href="/discussions" onClick={closeMoreMenu} className={navLinkClass("/discussions")}>
                  Discussions
                </Link>

                <Link href="/notifications" onClick={closeMoreMenu} className={navLinkClass("/notifications")}>
                  Alerts
                  {notificationCount > 0 && (
                    <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-black">
                      {notificationCount}
                    </span>
                  )}
                </Link>

                <div
                  ref={moreMenuRef}
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() => setMoreMenuOpen((current) => !current)}
                    aria-expanded={moreMenuOpen}
                    className="rounded-full border border-zinc-800 px-4 py-2 text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                  >
                    More
                  </button>

                  {moreMenuOpen && (
                    <div className="absolute right-0 z-50 mt-3 w-60 rounded-2xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
                      <p className="px-4 py-2 text-xs uppercase tracking-[0.18em] text-zinc-600">
                        Explore
                      </p>

                      <Link href="/search" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        Search
                      </Link>
                      <Link href="/people" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        People
                      </Link>
                      <Link href="/following" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        Following
                      </Link>
                      <Link href="/messages" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        Messages
                      </Link>
                      <Link href="/saved" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        Saved
                      </Link>
                      <Link href="/stickies" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        Stickies
                      </Link>

                      <p className="mt-2 px-4 py-2 text-xs uppercase tracking-[0.18em] text-zinc-600">
                        Account
                      </p>

                      <Link href="/dashboard" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        Home status
                      </Link>
                      <Link href="/my-activity" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        My Activity
                      </Link>
                      <Link href="/profile" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        Profile
                      </Link>
                      <Link href="/labs" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        Labs
                      </Link>
                      <Link href="/settings" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        Settings
                      </Link>
                      <Link href="/premium" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        Premium
                      </Link>

                      {isAdmin && (
                        <Link href="/admin" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                          Admin
                        </Link>
                      )}

                      <button
                        onClick={async () => {
                          closeMoreMenu();
                          await handleLogout();
                        }}
                        className="mt-2 block w-full rounded-xl border border-zinc-800 px-4 py-3 text-left text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-white"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </nav>
            </div>

          </div>
        </header>
      )}

      <div className={user ? "pb-24 md:pb-0 md:pl-24" : ""}>
        {user && (
        <div className={`loombus-mobile-topbar sticky top-0 z-40 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl transition-transform duration-300 md:hidden ${
          topNavHidden ? "-translate-y-full" : "translate-y-0"
        }`}>
          <div className="mx-auto flex max-w-md items-center justify-between">
            <Link
              href="/profile"
              aria-label="View profile"
              title="View profile"
              className="loombus-mobile-shell-avatar flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border text-sm font-semibold transition"
            >
              {navProfile?.avatar_url ? (
                <img
                  src={navProfile.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>
                  {(navProfile?.full_name ||
                    navProfile?.username ||
                    user.email ||
                    "U")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/search"
                aria-label="Search Loombus"
                title="Search Loombus"
                className="loombus-mobile-shell-button flex h-11 w-11 items-center justify-center rounded-full border transition"
              >
                <Search aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              </Link>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
                title="Open menu"
                aria-expanded={mobileMenuOpen}
                className="loombus-mobile-shell-button flex h-11 w-11 items-center justify-center rounded-full border transition"
              >
                <Menu aria-hidden="true" className="h-5 w-5" strokeWidth={2.05} />
              </button>
            </div>
          </div>

          {isDiscussionsIndex && (
            <nav
              aria-label="Mobile discussion feed views"
              className="mx-auto mt-3 grid max-w-md grid-cols-3 border-t border-[var(--loombus-border)] pt-2"
            >
              {([
                ["all", "All"],
                ["following", "Following"],
                ["signal", "Active"],
              ] as const).map(([feed, label]) => (
                <button
                  key={feed}
                  type="button"
                  onClick={() => selectMobileDiscussionFeed(feed)}
                  className={`relative flex h-10 items-center justify-center text-sm font-semibold transition ${
                    mobileDiscussionFeed === feed
                      ? "text-[var(--loombus-text)]"
                      : "text-[var(--loombus-text-muted)]"
                  }`}
                >
                  {label}
                  <span
                    className={`absolute bottom-0 h-1 rounded-full transition ${
                      mobileDiscussionFeed === feed
                        ? "bg-[var(--loombus-text)]"
                        : "bg-transparent"
                    } ${feed === "following" ? "w-20" : "w-14"}`}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </nav>
          )}
        </div>
      )}

      {children}
      </div>

      {user && hasDesktopRightRail && (
        <button
          type="button"
          aria-label="Resize right panel"
          aria-valuemin={MIN_RIGHT_RAIL_WIDTH}
          aria-valuemax={MAX_RIGHT_RAIL_WIDTH}
          aria-valuenow={rightRailWidth}
          title="Drag to resize the right panel"
          onMouseDown={startRightRailResize}
          onDoubleClick={() => setRightRailWidth(DEFAULT_RIGHT_RAIL_WIDTH)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              adjustRightRailWidth(20);
            }

            if (event.key === "ArrowRight") {
              event.preventDefault();
              adjustRightRailWidth(-20);
            }

            if (event.key === "Home") {
              event.preventDefault();
              setRightRailWidth(MIN_RIGHT_RAIL_WIDTH);
            }

            if (event.key === "End") {
              event.preventDefault();
              setRightRailWidth(MAX_RIGHT_RAIL_WIDTH);
            }
          }}
          className={`loombus-right-rail-resizer fixed inset-y-0 z-40 hidden w-3 cursor-col-resize xl:block ${
            rightRailResizing ? "loombus-right-rail-resizer-active" : ""
          }`}
        >
          <span className="sr-only">Resize right panel</span>
        </button>
      )}

      {user && mobileMenuOpen && (
        <div
          className="loombus-mobile-menu-backdrop fixed inset-0 z-50 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-md md:hidden"
          onClick={closeMobileMenu}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mobile app menu panel"
            className="loombus-mobile-menu-panel mx-auto flex max-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-5.5rem)] max-w-md flex-col overflow-y-auto rounded-[2rem] border p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="loombus-mobile-menu-header mb-4 flex items-center justify-between gap-3 border-b pb-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="loombus-mobile-menu-avatar flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border text-sm font-semibold">
                  {navProfile?.avatar_url ? (
                    <img
                      src={navProfile.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>
                      {(navProfile?.full_name ||
                        navProfile?.username ||
                        user.email ||
                        "U")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="loombus-mobile-menu-title truncate text-sm font-medium">
                    {navProfile?.full_name ||
                      (navProfile?.username ? `@${navProfile.username}` : user.email)}
                  </p>
                  <p className="loombus-mobile-menu-subtitle mt-1 truncate text-xs">
                    Move with signal.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeMobileMenu}
                className="loombus-mobile-menu-close rounded-full border px-3 py-2 text-xs transition"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4">
              <section>
                <p className="loombus-mobile-menu-section-label mb-2 px-1 text-xs uppercase tracking-[0.2em]">
                  Explore Loombus
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <Link href="/search" onClick={closeMobileMenu} className={mobileNavLinkClass("/search")}>
                    Search
                  </Link>

                  <Link href="/people" onClick={closeMobileMenu} className={mobileNavLinkClass("/people")}>
                    People
                  </Link>

                  <Link href="/following" onClick={closeMobileMenu} className={mobileNavLinkClass("/following")}>
                    Following
                  </Link>

                  <Link href="/messages" onClick={closeMobileMenu} className={mobileNavLinkClass("/messages")}>
                    Messages
                  </Link>

                  <Link href="/saved" onClick={closeMobileMenu} className={mobileNavLinkClass("/saved")}>
                    Saved
                  </Link>
                  <Link href="/stickies" onClick={closeMobileMenu} className={mobileNavLinkClass("/stickies")}>
                    Stickies
                  </Link>
                </div>
              </section>

              <section>
                <p className="loombus-mobile-menu-section-label mb-2 px-1 text-xs uppercase tracking-[0.2em]">
                  Your Signal
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <Link href="/profile" onClick={closeMobileMenu} className={mobileNavLinkClass("/profile")}>
                    Profile
                  </Link>

                  <Link href="/my-activity" onClick={closeMobileMenu} className={mobileNavLinkClass("/my-activity")}>
                    My Activity
                  </Link>

                  <Link href="/my-discussions" onClick={closeMobileMenu} className={mobileNavLinkClass("/my-discussions")}>
                    My Discussions
                  </Link>

                  <Link href="/my-replies" onClick={closeMobileMenu} className={mobileNavLinkClass("/my-replies")}>
                    My Replies
                  </Link>
                </div>
              </section>

              <section>
                <p className="loombus-mobile-menu-section-label mb-2 px-1 text-xs uppercase tracking-[0.2em]">
                  Continue
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <Link href="/reading-history" onClick={closeMobileMenu} className={mobileNavLinkClass("/reading-history")}>
                    Reading History
                  </Link>

                  <Link href="/dashboard" onClick={closeMobileMenu} className={mobileNavLinkClass("/dashboard")}>
                    Home status
                  </Link>
                </div>
              </section>

              <section>
                <p className="loombus-mobile-menu-section-label mb-2 px-1 text-xs uppercase tracking-[0.2em]">
                  Account
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <Link href="/settings" onClick={closeMobileMenu} className={mobileNavLinkClass("/settings")}>
                    Settings
                  </Link>

                  <Link href="/labs" onClick={closeMobileMenu} className={mobileNavLinkClass("/labs")}>
                    Labs
                  </Link>

                  <Link href="/premium" onClick={closeMobileMenu} className={mobileNavLinkClass("/premium")}>
                    Premium
                  </Link>

                  <Link href="/ai-usage" onClick={closeMobileMenu} className={mobileNavLinkClass("/ai-usage")}>
                    AI Usage
                  </Link>

                  {isAdmin && (
                    <Link href="/admin" onClick={closeMobileMenu} className={mobileNavLinkClass("/admin")}>
                      Admin
                    </Link>
                  )}
                </div>
              </section>

              <button
                onClick={async () => {
                  closeMobileMenu();
                  await handleLogout();
                }}
                className="loombus-mobile-menu-logout rounded-2xl border px-4 py-3 text-left text-sm font-medium transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {user && !mobileMenuOpen && (
        <nav
          aria-label="Mobile app navigation"
          className={`loombus-mobile-bottom-nav fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-50 rounded-[1.75rem] border p-2 backdrop-blur-xl transition-transform duration-300 md:hidden ${
            bottomNavHidden ? "translate-y-[calc(100%+1rem)]" : "translate-y-0"
          }`}
        >
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
            <Link href="/" aria-label="Home" title="Home" onClick={closeMobileMenu} className={appTabClass("/")}>
              <MobileNavIcon name="home" />
            </Link>

            <Link href="/discussions" aria-label="Discussions" title="Discussions" onClick={closeMobileMenu} className={appTabClass("/discussions")}>
              <MobileNavIcon name="discuss" />
            </Link>

            <Link href="/create" aria-label="Create" title="Create" onClick={closeMobileMenu} className={appTabClass("/create")}>
              <MobileNavIcon name="create" />
            </Link>

            <Link href="/people" aria-label="People" title="People" onClick={closeMobileMenu} className={appTabClass("/people")}>
              <MobileNavIcon name="people" />
            </Link>

            <Link href="/notifications" aria-label="Alerts" title="Alerts" onClick={closeMobileMenu} className={appTabClass("/notifications")}>
              <span className="relative">
                <MobileNavIcon name="alerts" />
                {notificationCount > 0 && (
                  <span className="loombus-mobile-nav-badge absolute -right-2 -top-2 min-w-4 rounded-full px-1 text-center text-[9px] font-semibold leading-4">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </span>
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
