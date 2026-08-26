"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { DiscussionViewerInsights } from "@/components/discussion-viewer-insights";
import { ProfileViewersPanel } from "@/components/profile-viewers-panel";

export default function InsightsClient() {
  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link
              href="/home"
              className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-gold)]"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Home
            </Link>

            <p className="text-xs font-bold uppercase tracking-[.22em] text-[var(--loombus-gold)]">
              Loombus Insights
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
              Understand your signal.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)] sm:text-base">
              Private analytics for your discussions, profile activity, and the members engaging with your work.
            </p>
          </div>

          <div className="grid size-12 place-items-center rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-gold)]">
            <BarChart3 className="size-5" aria-hidden="true" />
          </div>
        </header>

        <nav
          className="mb-6 flex gap-2 overflow-x-auto border-b border-[var(--loombus-border)]"
          aria-label="Insights sections"
        >
          <button
            type="button"
            className="border-b-2 border-[var(--loombus-gold)] px-3 py-3 text-sm font-black text-[var(--loombus-text)]"
          >
            Discussions
          </button>
          <button
            type="button"
            disabled
            className="px-3 py-3 text-sm font-bold text-[var(--loombus-text-subtle)]"
            title="Coming next"
          >
            Replies
          </button>
          <button
            type="button"
            disabled
            className="px-3 py-3 text-sm font-bold text-[var(--loombus-text-subtle)]"
            title="Coming next"
          >
            Account
          </button>
        </nav>

        <DiscussionViewerInsights />
        <ProfileViewersPanel />
      </div>
    </main>
  );
}
