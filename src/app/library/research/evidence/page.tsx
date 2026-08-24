import Link from "next/link";
import { GitBranch, MessageSquareShare, Network } from "lucide-react";
import { LibraryEvidenceKnowledgeSurface } from "@/components/library/library-evidence-knowledge-surface";
import { LibraryKnowledgePromotionBridge } from "@/components/library/library-knowledge-promotion-bridge";

export default function LibraryEvidenceKnowledgePage() {
  return (
    <>
      <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2 md:bottom-6 md:right-6">
        <Link
          href="/library/research/evidence/graph"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2.5 text-sm font-black text-[var(--loombus-gold)] shadow-lg"
        >
          <Network className="size-4" /> Knowledge Graph
        </Link>
        <Link
          href="/library/research/evidence/provenance"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2.5 text-sm font-black text-[var(--loombus-gold)] shadow-lg"
        >
          <GitBranch className="size-4" /> Provenance
        </Link>
        <Link
          href="/library/research/evidence/promote"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2.5 text-sm font-black text-[var(--loombus-gold)] shadow-lg"
        >
          <MessageSquareShare className="size-4" /> Promote to Discussion
        </Link>
      </div>
      <LibraryKnowledgePromotionBridge />
      <LibraryEvidenceKnowledgeSurface />
    </>
  );
}
