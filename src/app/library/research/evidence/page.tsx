import Link from "next/link";
import { MessageSquareShare } from "lucide-react";
import { LibraryEvidenceKnowledgeSurface } from "@/components/library/library-evidence-knowledge-surface";

export default function LibraryEvidenceKnowledgePage() {
  return (
    <>
      <Link
        href="/library/research/evidence/promote"
        className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2.5 text-sm font-black text-[var(--loombus-gold)] shadow-lg md:bottom-6 md:right-6"
      >
        <MessageSquareShare className="size-4" /> Promote to Discussion
      </Link>
      <LibraryEvidenceKnowledgeSurface />
    </>
  );
}
