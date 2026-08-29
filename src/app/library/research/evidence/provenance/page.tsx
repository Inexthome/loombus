import { LibraryFocusedProvenanceSurface } from "@/components/library/library-focused-provenance-surface";
import { LibraryKnowledgeProvenanceSurface } from "@/components/library/library-knowledge-provenance-surface";
import { LibraryResearchEditorialNav } from "@/components/library/library-research-editorial-nav";
import "../../library-research-editorial.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LibraryKnowledgeProvenancePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const focusKind = typeof params.focusKind === "string" ? params.focusKind : "";
  const focusId = typeof params.focusId === "string" ? params.focusId : "";
  const relation = typeof params.relation === "string" ? params.relation : "";
  const focused = (focusKind === "claim" || focusKind === "knowledge") && focusId && relation;

  return (
    <div data-library-research-editorial="provenance">
      <LibraryResearchEditorialNav active="provenance" />
      {focused ? (
        <LibraryFocusedProvenanceSurface focusKind={focusKind} focusId={focusId} relation={relation} />
      ) : (
        <LibraryKnowledgeProvenanceSurface />
      )}
    </div>
  );
}
