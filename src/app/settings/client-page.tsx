"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  getAiUsageLabel,
  getSubscriptionDisplay,
} from "@/lib/subscription-plans";

type AiEntitlement = {
  tier: string;
  ai_assisted_enabled: boolean;
  monthly_summary_limit: number;
};

function withSettingsTimeout<T>(
  promise: PromiseLike<T>,
  label: string,
  ms = 8000
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out. Please reload settings.`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

const settingsSections = [
  {
    title: "Account",
    items: [
      {
        title: "Profile",
        description: "Edit your public profile, username, full name, and bio.",
        href: "/profile",
      },
      {
        title: "Notification Settings",
        description: "Choose which replies, follows, and mentions can notify you.",
        href: "/profile",
      },
      {
        title: "Blocked Users",
        description: "Review blocked members and unblock them from one place.",
        href: "/blocked-users",
      },
    ],
  },
  {
    title: "Activity",
    items: [
      {
        title: "My Activity",
        description: "See your full activity overview in one place.",
        href: "/my-activity",
      },
      {
        title: "My Discussions",
        description: "Review the discussions you started.",
        href: "/my-discussions",
      },
      {
        title: "My Replies",
        description: "Review the replies you contributed.",
        href: "/my-replies",
      },
      {
        title: "Saved",
        description: "Revisit discussions you saved for later.",
        href: "/saved",
      },
      {
        title: "Reading History",
        description: "Revisit discussions you opened recently.",
        href: "/reading-history",
      },
      {
        title: "Notifications",
        description: "Review unread and read notifications.",
        href: "/notifications",
      },
    ],
  },
  {
    title: "Platform",
    items: [
      {
        title: "About Loombus",
        description: "Read the platform purpose and positioning.",
        href: "/about",
      },
      {
        title: "Premium",
        description: "Review Loombus Premium AI subscription options and checkout access.",
        href: "/premium",
      },
      {
        title: "Guidelines",
        description: "Review community standards and contribution expectations.",
        href: "/guidelines",
      },
      {
        title: "Safety",
        description: "Review safety expectations, reporting, blocking, and enforcement.",
        href: "/safety",
      },
      {
        title: "Contact",
        description: "Get help with support, safety concerns, accessibility, or account questions.",
        href: "/contact",
      },
    ],
  },
];

export default function SettingsClientPage() {
  const [aiEntitlement, setAiEntitlement] = useState<AiEntitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function requireUser() {
      setLoadError("");

      try {
        const { data, error: userError } = await withSettingsTimeout(
          supabase.auth.getUser(),
          "Settings authentication check"
        );

        if (userError) {
          throw userError;
        }

        if (!data.user) {
          window.location.replace("/login");
          return;
        }

        const entitlementResult = await withSettingsTimeout(
          supabase
            .from("user_ai_entitlements")
            .select("tier, ai_assisted_enabled, monthly_summary_limit")
            .eq("user_id", data.user.id)
            .maybeSingle(),
          "Settings subscription check"
        );

        if (entitlementResult.error) {
          throw entitlementResult.error;
        }

        setAiEntitlement(entitlementResult.data ?? null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load settings.";
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    }

    requireUser();
  }, []);

  const subscriptionDisplay = getSubscriptionDisplay(aiEntitlement);
  const aiUsageLabel = getAiUsageLabel(aiEntitlement);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading settings...
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
          <h1 className="mb-3 text-2xl font-medium">
            Settings could not load.
          </h1>

          <p className="mb-5 text-sm leading-relaxed text-zinc-500">
            {loadError}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Reload settings
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/dashboard"
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to dashboard
        </Link>

        <div className="mb-10">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Account
          </p>

          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
            Settings
          </h1>

          <p className="mt-4 max-w-2xl leading-relaxed text-zinc-500">
            Manage your profile, activity, notifications, saved items,
            and platform reference pages from one place.
          </p>
        </div>

        <section className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                Current plan
              </p>

              <h2 className="text-2xl font-medium">
                {subscriptionDisplay.label}
              </h2>
            </div>

            <span className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300">
              {subscriptionDisplay.badge}
            </span>
          </div>

          <p className="mb-3 leading-relaxed text-zinc-400">
            {subscriptionDisplay.description}
          </p>

          <p className="mb-5 text-sm text-zinc-500">
            Included AI usage: {aiUsageLabel}
          </p>

          <Link
            href={subscriptionDisplay.href}
            className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            {subscriptionDisplay.nextAction}
          </Link>
        </section>

        <div className="space-y-8">
          {settingsSections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-4 text-2xl font-medium">
                {section.title}
              </h2>

              <div className="grid gap-6 md:grid-cols-2">
                {section.items.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
                  >
                    <h3 className="mb-3 text-xl font-medium">
                      {item.title}
                    </h3>

                    <p className="leading-relaxed text-zinc-400">
                      {item.description}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
