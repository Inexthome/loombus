import { LibraryKnowledgeGraphPromotionContext } from "@/components/library/library-knowledge-graph-promotion-context";
import { LibraryKnowledgeGraphV7Surface } from "@/components/library/library-knowledge-graph-v7-surface";
import { LibraryResearchEditorialNav } from "@/components/library/library-research-editorial-nav";
import "./library-knowledge-graph-editorial.css";
import "./library-knowledge-graph-editorial-v6.css";
import "./library-knowledge-graph-editorial-completion.css";
import "./library-knowledge-graph-editorial-structural.css";

export default function LibraryKnowledgeGraphPage() {
  return (
    <div data-library-knowledge-graph-editorial>
      <LibraryResearchEditorialNav active="graph" />
      <LibraryKnowledgeGraphPromotionContext />
      <LibraryKnowledgeGraphV7Surface />
    </div>
  );
}
