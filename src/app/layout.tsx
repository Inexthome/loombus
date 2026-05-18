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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

                <Link href="/about" className="transition hover:text-white">
                  About
                </Link>

                {user && (
                  <>
                    <Link href="/following" className="transition hover:text-white">
                      Following
                    </Link>

                    <Link href="/saved" className="transition hover:text-white">
                      Saved
                    </Link>

                    <Link href="/create" className="transition hover:text-white">
                      Create
                    </Link>

                    <Link href="/profile" className="transition hover:text-white">
                      Profile
                    </Link>

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
                <Link href="/discussions">
                  Discussions
                </Link>

                <Link href="/people">
                  People
                </Link>

                <Link href="/about">
                  About
                </Link>

                {user && (
                  <>
                    <Link href="/following">
                      Following
                    </Link>

                    <Link href="/saved">
                      Saved
                    </Link>

                    <Link href="/create">
                      Create
                    </Link>

                    <Link href="/profile">
                      Profile
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="text-left"
                    >
                      Logout
                    </button>
                  </>
                )}

                {!user && (
                  <>
                    <Link href="/login">
                      Login
                    </Link>

                    <Link href="/signup">
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
