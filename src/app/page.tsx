import type { Metadata } from "next";
import Link from "next/link";
import { HomeAuthRedirect } from "@/components/home-auth-redirect";

export const metadata: Metadata = {
  title: "Loombus | Signal over noise",
  description:
    "Loombus is a signal-first discussion platform for thoughtful conversations, sharper ideas, and cleaner community dialogue.",
  alternates: {
    canonical: "https://loombus.com/",
  },
};

const publicLinks = [
  {
    title: "About Loombus",
    href: "/about",
    description: "Learn what Loombus is and why it exists.",
  },
  {
    title: "Download Loombus",
    href: "/download",
    description: "Get Loombus on mobile and join thoughtful discussions.",
  },
  {
    title: "Login to Loombus",
    href: "/login",
    description: "Return to your discussions, replies, and saved ideas.",
  },
  {
    title: "Create an account",
    href: "/signup",
    description: "Join Loombus and start participating in better conversations.",
  },
];

export default function RootPage() {
  return (
    <main className="min-h-screen bg-[var(--loombus-bg)] px-6 py-16 text-[var(--loombus-text)]">
      <HomeAuthRedirect />

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-14">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.3em] text-[var(--loombus-text-muted)]">
            Loombus
          </p>

          <h1 className="text-4xl font-semibold tracking-tight text-[var(--loombus-text)] sm:text-6xl">
            Signal over noise.
          </h1>

          <p className="mt-6 text-lg leading-8 text-[var(--loombus-text-muted)] sm:text-xl">
            Loombus is a high-signal discussion platform built for thoughtful
            conversations, sharper ideas, and cleaner community dialogue.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="loombus-public-primary-cta rounded-full px-5 py-3 text-sm font-semibold transition hover:opacity-90"
            >
              Create an account
            </Link>

            <Link
              href="/download"
              className="loombus-public-secondary-cta rounded-full border px-5 py-3 text-sm font-semibold transition hover:bg-[var(--loombus-surface-muted)]"
            >
              Download Loombus
            </Link>
          </div>
        </div>

        <div>
          <h2 className="mb-5 text-xl font-semibold text-[var(--loombus-text)]">
            Start with Loombus
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {publicLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--loombus-surface-muted)]"
              >
                <h3 className="text-xl font-semibold text-[var(--loombus-text)]">
                  {item.title}
                </h3>

                <p className="mt-3 leading-7 text-[var(--loombus-text-muted)]">
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
