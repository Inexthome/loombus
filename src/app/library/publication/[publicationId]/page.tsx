import Link from "next/link";
import { UsersRound } from "lucide-react";
import { LibraryPublicationCommerceBoundary } from "@/components/library/library-publication-commerce-boundary";
import { LibraryPublicationDetail } from "@/components/library/library-publication-detail";
import "../../library-publication-workflows-editorial.css";

export default async function LibraryPublicationDetailPage({
  params,
}: {
  params: Promise<{ publicationId: string }>;
}) {
  const { publicationId } = await params;
  return (
    <div data-library-publication-editorial>
      <LibraryPublicationCommerceBoundary publicationId={publicationId}>
        <LibraryPublicationDetail publicationId={publicationId} />
      </LibraryPublicationCommerceBoundary>
      <div className="mx-auto -mt-16 w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="border-t border-[var(--loombus-border)] pt-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Read together</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--loombus-text)]">Book Club</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">Join this book’s canonical Book Club Hub to enter its active reading session or see other groups.</p>
            </div>
            <Link href={`/library/publication/${publicationId}/book-club`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 text-sm font-semibold text-[var(--loombus-text)] transition hover:border-[var(--loombus-gold)]">
              <UsersRound className="h-4 w-4 text-[var(--loombus-gold)]" />Join Book Club
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
