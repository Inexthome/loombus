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
  const currentUserIdRef = useRef<string | null>(null);
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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-black text-white antialiased">
        <header className="border-b border-zinc-900">
          <div className="mx-auto max-w-6xl px-6 py-5">

            <div className="flex items-center justify-between">
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

              <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
                <Link href="/" className={navLinkClass("/")}>
                  Home
                </Link>

                <Link href="/discussions" className={navLinkClass("/discussions")}>
                  Discussions
                </Link>
                <Link
                  href="/premium"
                  className="transition hover:text-white"
                >
                  Premium
                </Link>



                {user && (
                  <>
                    <Link href="/people" className={navLinkClass("/people")}>
                      People
                    </Link>


                    <Link href="/notifications" className={navLinkClass("/notifications")}>
                      Notifications
                      {notificationCount > 0 && (
                        <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-black">
                          {notificationCount}
                        </span>
                      )}
                    </Link>
                    <Link href="/dashboard" className={navLinkClass("/dashboard")}>
                      Dashboard
                    </Link>
                    <Link href="/settings" className={navLinkClass("/settings")}>
                      Settings
                    </Link>

                    <Link href="/create" className={navLinkClass("/create")}>
                      Create
                    </Link>


                    {isAdmin && (
                      <Link href="/admin" className={navLinkClass("/admin")}>
                        Admin
                      </Link>
                    )}

                    <button
                      onClick={handleLogout}
                      className="transition hover:text-white"
                    >
                      Logout
                    </button>
                  </>
                )}

                {!user && (
                  <>
                    <Link href="/login" className={navLinkClass("/login")}>
                      Login
                    </Link>

                    <Link href="/signup" className={navLinkClass("/signup")}>
                      Sign Up
                    </Link>
                  </>
                )}
              </nav>
            </div>

            {mobileMenuOpen && (
              <nav className="mt-5 flex flex-col gap-4 border-t border-zinc-900 pt-5 text-sm text-zinc-400 md:hidden">
                <Link href="/" onClick={closeMobileMenu} className={mobileNavLinkClass("/")}>
                  Home
                </Link>

                <Link href="/discussions" onClick={closeMobileMenu} className={mobileNavLinkClass("/discussions")}>
                  Discussions
                </Link>
                <Link
                  href="/premium"
                  className="transition hover:text-white"
                >
                  Premium
                </Link>



                {user && (
                  <>
                    <Link href="/people" onClick={closeMobileMenu} className={mobileNavLinkClass("/people")}>
                      People
                    </Link>


                    <Link href="/notifications" onClick={closeMobileMenu} className={mobileNavLinkClass("/notifications")}>
                      Notifications
                      {notificationCount > 0 && (
                        <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-black">
                          {notificationCount}
                        </span>
                      )}
                    </Link>
                    <Link href="/dashboard" onClick={closeMobileMenu} className={mobileNavLinkClass("/dashboard")}>
                      Dashboard
                    </Link>
                    <Link href="/settings" onClick={closeMobileMenu} className={mobileNavLinkClass("/settings")}>
                      Settings
                    </Link>

                    <Link href="/create" onClick={closeMobileMenu} className={mobileNavLinkClass("/create")}>
                      Create
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
                      className="text-left"
                    >
                      Logout
                    </button>
                  </>
                )}

                {!user && (
                  <>
                    <Link href="/login" onClick={closeMobileMenu} className={mobileNavLinkClass("/login")}>
                      Login
                    </Link>

                    <Link href="/signup" onClick={closeMobileMenu} className={mobileNavLinkClass("/signup")}>
                      Sign Up
                    </Link>
                  </>
                )}
              </nav>
            )}

          </div>
        </header>

        {children}
    </div>
  );
}
