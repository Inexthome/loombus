import Link from "next/link";
import type { ReactNode } from "react";

export default function AdminLibraryReviewLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav aria-label="Library editorial review" className="border-b border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-[var(--loombus-text)] sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap gap-2">
          <Link href="/admin/library-review" className="inline-flex min-h-10 items-center rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold hover:border-[var(--loombus-gold)]">First publications</Link>
          <Link href="/admin/library-review/revisions" className="inline-flex min-h-10 items-center rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold hover:border-[var(--loombus-gold)]">Published revisions</Link>
        </div>
      </nav>
      {children}
    </>
  );
}
