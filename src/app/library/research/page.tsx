import Link from "next/link";
import { Brain } from "lucide-react";
import { LibraryResearchPassageHandoff } from "@/components/library/library-research-passage-handoff";
import { LibraryResearchSurface } from "@/components/library/library-research-surface";

export default function LibraryResearchPage() {
  return (
    <div className="relative">
      <Link
        href="/library/research/evidence"
        className="absolute right-4 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 py-2 text-xs font-black text-[var(--loombus-gold)] shadow-sm hover:border-[var(--loombus-gold)] md:right-6 md:top-20"
      >
        <Brain className="size-4" />
        Evidence & Knowledge
      </Link>
      <LibraryResearchPassageHandoff />
      <LibraryResearchSurface />
    </div>
  );
}
