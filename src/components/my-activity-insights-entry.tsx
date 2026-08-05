import { ArrowRight, Eye } from "lucide-react";
import Link from "next/link";

export function MyActivityInsightsEntry() {
  return (
    <section className="mx-auto mt-6 max-w-[86rem] px-4 sm:px-6 lg:px-8" aria-label="Viewer insights">
      <Link
        href="/my-activity/insights"
        className="group flex flex-col gap-4 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 text-[var(--loombus-text)] shadow-sm transition hover:border-[var(--loombus-gold)] sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-surface-muted)] text-[var(--loombus-gold)]">
            <Eye className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--loombus-gold)]">
              Insights
            </p>
            <h2 className="mt-1 text-xl font-black">Review your private viewer activity.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
              See who viewed your discussions and profile from one owner-only workspace.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--loombus-gold)]">
          Open insights
          <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </Link>
    </section>
  );
}
