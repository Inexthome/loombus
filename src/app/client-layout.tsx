"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
      ? "text-white transition hover:text-white"
      : "text-zinc-400 transition hover:text-white";
  }

  async function loadNotificationCount(userId: string) {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);

    setNotificationCount(count ?? 0);
  }

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      setUser(data.user ?? null);

      if (!data.user) {
        setNotificationCount(0);
      }

      if (data.user) {
        await loadNotificationCount(data.user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", data.user.id)
          .single();

        setIsAdmin(Boolean(profile?.is_admin));
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        await loadNotificationCount(session.user.id);
      } else {
        setNotificationCount(0);
      }
    });

    async function handleNotificationsChanged() {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        await loadNotificationCount(data.user.id);
      } else {
        setNotificationCount(0);
      }
    }

    window.addEventListener(
      "loombus:notifications-changed",
      handleNotificationsChanged
    );

    return () => {
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
                className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white md:hidden"
              >
                Menu
              </button>

              <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
                <Link href="/discussions" className={navLinkClass("/discussions")}>
                  Discussions
                </Link>

                <Link href="/people" className={navLinkClass("/people")}>
                  People
                </Link>



                {user && (
                  <>
                    <Link href="/following" className={navLinkClass("/following")}>
                      Following
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
                <Link href="/discussions" onClick={closeMobileMenu} className={mobileNavLinkClass("/discussions")}>
                  Discussions
                </Link>

                <Link href="/people" onClick={closeMobileMenu} className={mobileNavLinkClass("/people")}>
                  People
                </Link>



                {user && (
                  <>
                    <Link href="/following" onClick={closeMobileMenu} className={mobileNavLinkClass("/following")}>
                      Following
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
