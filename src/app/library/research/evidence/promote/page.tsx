import { LibraryKnowledgeDiscussionPromotionSurface } from "@/components/library/library-knowledge-discussion-promotion-surface";
import { LibraryResearchEditorialNav } from "@/components/library/library-research-editorial-nav";
import "../../library-research-editorial.css";
import "../../library-research-editorial-completion.css";

export default function LibraryKnowledgeDiscussionPromotionPage() {
  return (
    <div data-library-research-editorial="promote">
      <LibraryResearchEditorialNav active="promote" />
      <LibraryKnowledgeDiscussionPromotionSurface />
    </div>
  );
}
