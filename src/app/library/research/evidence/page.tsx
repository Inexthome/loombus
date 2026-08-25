import Link from "next/link";
import { ChevronDown, GitBranch, MessageSquareShare, Network } from "lucide-react";
import { LibraryEvidenceKnowledgeSurface } from "@/components/library/library-evidence-knowledge-surface";
import { LibraryKnowledgePromotionBridge } from "@/components/library/library-knowledge-promotion-bridge";

export default function LibraryEvidenceKnowledgePage() {
  return (
    <div className="relative">
      <div className="absolute right-4 top-5 z-40 md:right-6 md:top-20">
        <details className="relative">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 text-sm font-black text-[var(--loombus-gold)] shadow-sm transition hover:border-[var(--loombus-gold)] [&::-webkit-details-marker]:hidden">
            Knowledge tools
            <ChevronDown className="size-4" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-1.5 shadow-xl">
            <Link href="/library/research/evidence/graph" className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-[var(--loombus-surface-muted)]">
              <Network className="size-4 text-[var(--loombus-gold)]" aria-hidden="true" /> Knowledge Graph
            </Link>
            <Link href="/library/research/evidence/provenance" className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-[var(--loombus-surface-muted)]">
              <GitBranch className="size-4 text-[var(--loombus-gold)]" aria-hidden="true" /> Provenance
            </Link>
            <Link href="/library/research/evidence/promote" className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-[var(--loombus-surface-muted)]">
              <MessageSquareShare className="size-4 text-[var(--loombus-gold)]" aria-hidden="true" /> Promote to Discussion
            </Link>
          </div>
        </details>
      </div>
      <LibraryKnowledgePromotionBridge />
      <LibraryEvidenceKnowledgeSurface />
    </div>
  );
}
