"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const settingsItems = [
  {
    title: "Profile",
    description: "Edit your public profile, username, bio, and notification preferences.",
    href: "/profile",
  },
  {
    title: "My Activity",
    description: "Review your discussions, replies, saved items, and notifications.",
    href: "/my-activity",
  },
  {
    title: "Notification Settings",
    description: "Choose which replies, follows, and mentions can notify you.",
    href: "/profile",
  },
  {
    title: "About Loombus",
    description: "Read the platform purpose and positioning.",
    href: "/about",
  },
  {
    title: "Guidelines",
    description: "Review community standards and contribution expectations.",
    href: "/guidelines",
  },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function requireUser() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        window.location.href = "/login";
        return;
      }

      setLoading(false);
    }

    requireUser();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl text-zinc-400">
          Loading settings...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard"
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to dashboard
        </Link>

        <div className="mb-12">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Account
          </p>

          <h1 className="text-5xl font-semibold tracking-tight">
            Settings
          </h1>

          <p className="mt-4 max-w-2xl leading-relaxed text-zinc-500">
            Manage your Loombus profile, activity, notification preferences,
            and platform reference pages from one place.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {settingsItems.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
            >
              <h2 className="mb-3 text-2xl font-medium">
                {item.title}
              </h2>

              <p className="leading-relaxed text-zinc-400">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
