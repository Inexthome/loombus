import Link from "next/link";
import { DiscussionViewerInsights } from "@/components/discussion-viewer-insights";
import { ProfileViewersPanel } from "@/components/profile-viewers-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ViewerInsightsPage() {
  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[86rem]">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--loombus-gold)]">
                My Activity · Insights
              </p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">Your private viewer insights.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)] sm:text-base">
                Review who viewed your discussions and profile. Viewer identities remain visible only to you and authorized administrators, while members who disable viewer identity appear as Private viewer.
              </p>
            </div>
            <Link
              href="/my-activity"
              className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-bold text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-gold)] hover:text-[var(--loombus-gold)]"
            >
              Back to My Activity
            </Link>
          </div>
        </header>

        <DiscussionViewerInsights />
        <ProfileViewersPanel />
      </div>
    </main>
  );
}
