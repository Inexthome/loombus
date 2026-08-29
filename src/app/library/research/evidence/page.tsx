import { LibraryEvidenceKnowledgeSurface } from "@/components/library/library-evidence-knowledge-surface";
import { LibraryKnowledgePromotionBridge } from "@/components/library/library-knowledge-promotion-bridge";
import { LibraryResearchEditorialNav } from "@/components/library/library-research-editorial-nav";
import "../library-research-editorial.css";

export default function LibraryEvidenceKnowledgePage() {
  return (
    <div data-library-research-editorial="evidence">
      <LibraryResearchEditorialNav active="evidence" />
      <LibraryKnowledgePromotionBridge />
      <LibraryEvidenceKnowledgeSurface />
    </div>
  );
}
