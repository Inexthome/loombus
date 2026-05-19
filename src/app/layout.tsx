"use client";

import "./globals.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <html lang="en">
      <body className="bg-black text-white antialiased">
        <header className="border-b border-zinc-900">
          <div className="mx-auto max-w-6xl px-6 py-5">

            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="text-xl font-semibold tracking-tight"
              >
                Loombus
              </Link>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white md:hidden"
              >
                Menu
              </button>

              <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
                <Link href="/discussions" className="transition hover:text-white">
                  Discussions
                </Link>

                <Link href="/people" className="transition hover:text-white">
                  People
                </Link>



                {user && (
                  <>
                    <Link href="/following" className="transition hover:text-white">
                      Following
                    </Link>


                    <Link href="/notifications" className="transition hover:text-white">
                      Notifications
                      {notificationCount > 0 && (
                        <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-black">
                          {notificationCount}
                        </span>
                      )}
                    </Link>
                    <Link href="/dashboard" className="transition hover:text-white">
                      Dashboard
                    </Link>
                    <Link href="/settings" className="transition hover:text-white">
                      Settings
                    </Link>

                    <Link href="/create" className="transition hover:text-white">
                      Create
                    </Link>


                    {isAdmin && (
                      <Link href="/admin" className="transition hover:text-white">
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
                    <Link href="/login" className="transition hover:text-white">
                      Login
                    </Link>

                    <Link href="/signup" className="transition hover:text-white">
                      Sign Up
                    </Link>
                  </>
                )}
              </nav>
            </div>

            {mobileMenuOpen && (
              <nav className="mt-5 flex flex-col gap-4 border-t border-zinc-900 pt-5 text-sm text-zinc-400 md:hidden">
                <Link href="/discussions" onClick={closeMobileMenu}>
                  Discussions
                </Link>

                <Link href="/people" onClick={closeMobileMenu}>
                  People
                </Link>



                {user && (
                  <>
                    <Link href="/following" onClick={closeMobileMenu}>
                      Following
                    </Link>


                    <Link href="/notifications" onClick={closeMobileMenu}>
                      Notifications
                      {notificationCount > 0 && (
                        <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-black">
                          {notificationCount}
                        </span>
                      )}
                    </Link>
                    <Link href="/dashboard" onClick={closeMobileMenu}>
                      Dashboard
                    </Link>
                    <Link href="/settings" onClick={closeMobileMenu}>
                      Settings
                    </Link>

                    <Link href="/create" onClick={closeMobileMenu}>
                      Create
                    </Link>


                    {isAdmin && (
                      <Link href="/admin" onClick={closeMobileMenu}>
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
                    <Link href="/login" onClick={closeMobileMenu}>
                      Login
                    </Link>

                    <Link href="/signup" onClick={closeMobileMenu}>
                      Sign Up
                    </Link>
                  </>
                )}
              </nav>
            )}

          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
