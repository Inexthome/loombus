import { LibraryResearchDiscussionConvergence } from "@/components/library/library-research-discussion-convergence";
import { LibraryResearchEditorialNav } from "@/components/library/library-research-editorial-nav";
import { LibraryResearchPassageHandoff } from "@/components/library/library-research-passage-handoff";
import { LibraryResearchSurface } from "@/components/library/library-research-surface";
import "./library-research-editorial.css";

export default function LibraryResearchPage() {
  return (
    <div data-library-research-editorial="research">
      <LibraryResearchEditorialNav active="research" />
      <LibraryResearchPassageHandoff />
      <LibraryResearchDiscussionConvergence />
      <LibraryResearchSurface />
    </div>
  );
}
