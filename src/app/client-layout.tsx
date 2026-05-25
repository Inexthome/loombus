"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const loadingNotificationCountRef = useRef(false);
  const lastNotificationLoadRef = useRef<{ userId: string; loadedAt: number } | null>(null);
  const pathname = usePathname();

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
      ? "rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white transition hover:text-white"
      : "rounded-xl border border-transparent px-4 py-3 text-zinc-400 transition hover:border-zinc-800 hover:bg-zinc-950 hover:text-white";
  }

  function appTabClass(href: string) {
    const active =
      pathname === href || (href !== "/" && pathname.startsWith(href));

    return `flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition ${
      active
        ? "bg-white text-black"
        : "text-zinc-500 hover:bg-zinc-900 hover:text-white"
    }`;
  }

  function appMenuButtonClass() {
    return `flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition ${
      mobileMenuOpen
        ? "bg-white text-black"
        : "text-zinc-500 hover:bg-zinc-900 hover:text-white"
    }`;
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
          .select("is_admin")
          .eq("id", userId)
          .single();

        if (isMounted && currentUserIdRef.current === userId) {
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

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function closeMoreMenu() {
    setMoreMenuOpen(false);
  }

  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  }, [pathname]);

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
      {user && (
        <header className="border-b border-zinc-900">
          <div className="mx-auto max-w-6xl px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <Link
                href="/"
                className="flex items-center gap-3 text-xl font-semibold tracking-tight"
                aria-label="Loombus home"
              >
                <img
                  src="/assets/brand/loombus-mark-transparent.png"
                  alt=""
                  className="h-8 w-8 object-contain"
                />
                <span>Loombus</span>
              </Link>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle navigation menu"
                className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white md:hidden"
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
                  Notifications
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
                    <div className="absolute right-0 z-50 mt-3 w-56 rounded-2xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
                      <Link href="/people" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        People
                      </Link>
                      <Link href="/following" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        Following
                      </Link>
                      <Link href="/dashboard" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        Dashboard
                      </Link>
                      <Link href="/saved" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        Saved
                      </Link>
                      <Link href="/my-activity" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        My Activity
                      </Link>
                      <Link href="/profile" onClick={closeMoreMenu} className="block rounded-xl px-4 py-3 transition hover:bg-zinc-900 hover:text-white">
                        Profile
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

            {mobileMenuOpen && (
              <nav className="mt-5 flex flex-col gap-3 border-t border-zinc-900 pt-5 text-sm text-zinc-400 md:hidden">
                <Link href="/" onClick={closeMobileMenu} className={mobileNavLinkClass("/")}>
                  Home
                </Link>

                <Link href="/create" onClick={closeMobileMenu} className="rounded-xl bg-white px-4 py-3 text-black transition hover:bg-zinc-200">
                  Create
                </Link>

                <Link href="/discussions" onClick={closeMobileMenu} className={mobileNavLinkClass("/discussions")}>
                  Discussions
                </Link>

                <Link href="/notifications" onClick={closeMobileMenu} className={mobileNavLinkClass("/notifications")}>
                  Notifications
                  {notificationCount > 0 && (
                    <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-black">
                      {notificationCount}
                    </span>
                  )}
                </Link>

                <div className="my-2 border-t border-zinc-900" />

                <Link href="/people" onClick={closeMobileMenu} className={mobileNavLinkClass("/people")}>
                  People
                </Link>

                <Link href="/following" onClick={closeMobileMenu} className={mobileNavLinkClass("/following")}>
                  Following
                </Link>

                <Link href="/dashboard" onClick={closeMobileMenu} className={mobileNavLinkClass("/dashboard")}>
                  Dashboard
                </Link>

                <Link href="/saved" onClick={closeMobileMenu} className={mobileNavLinkClass("/saved")}>
                  Saved
                </Link>

                <Link href="/my-activity" onClick={closeMobileMenu} className={mobileNavLinkClass("/my-activity")}>
                  My Activity
                </Link>

                <Link href="/profile" onClick={closeMobileMenu} className={mobileNavLinkClass("/profile")}>
                  Profile
                </Link>

                <Link href="/settings" onClick={closeMobileMenu} className={mobileNavLinkClass("/settings")}>
                  Settings
                </Link>

                <Link href="/premium" onClick={closeMobileMenu} className={mobileNavLinkClass("/premium")}>
                  Premium
                </Link>

                {isAdmin && (
                  <Link href="/admin" onClick={closeMobileMenu} className={mobileNavLinkClass("/admin")}>
                    Admin
                  </Link>
                )}

                <button
                  onClick={async () => {
                    closeMobileMenu();
                    await handleLogout();
                  }}
                  className="rounded-xl border border-zinc-800 px-4 py-3 text-left text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-950 hover:text-white"
                >
                  Logout
                </button>
              </nav>
            )}
          </div>
        </header>
      )}

      <div className={user ? "pb-24 md:pb-0" : ""}>
        {children}
      </div>

      {user && (
        <nav
          aria-label="Mobile app navigation"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-900 bg-black/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-2xl shadow-black/60 backdrop-blur md:hidden"
        >
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
            <Link href="/" onClick={closeMobileMenu} className={appTabClass("/")}>
              <span className="text-base leading-none">⌂</span>
              <span className="truncate">Home</span>
            </Link>

            <Link href="/create" onClick={closeMobileMenu} className={appTabClass("/create")}>
              <span className="text-base leading-none">＋</span>
              <span className="truncate">Create</span>
            </Link>

            <Link href="/discussions" onClick={closeMobileMenu} className={appTabClass("/discussions")}>
              <span className="text-base leading-none">◌</span>
              <span className="truncate">Discuss</span>
            </Link>

            <Link href="/notifications" onClick={closeMobileMenu} className={appTabClass("/notifications")}>
              <span className="relative text-base leading-none">
                ◇
                {notificationCount > 0 && (
                  <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-white px-1 text-[10px] leading-4 text-black">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </span>
              <span className="truncate">Alerts</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((current) => !current)}
              aria-expanded={mobileMenuOpen}
              className={appMenuButtonClass()}
            >
              <span className="text-base leading-none">☰</span>
              <span className="truncate">Menu</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
