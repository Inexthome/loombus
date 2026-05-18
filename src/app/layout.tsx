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
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <Link
              href="/"
              className="text-xl font-semibold tracking-tight"
            >
              Loombus
            </Link>

            <nav className="flex items-center gap-6 text-sm text-zinc-400">
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
        </header>

        {children}
      </body>
    </html>
  );
}
