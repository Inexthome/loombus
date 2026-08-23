import { LibraryDiscussPassageLauncher } from "@/components/library/library-discuss-passage-launcher";
import { LibraryReaderAccessBoundary } from "@/components/library/library-reader-access-boundary";
import { LibraryReaderSurface } from "@/components/library/library-reader-surface";
import { LibraryResearchShortcut } from "@/components/library/library-research-shortcut";

export default async function LibraryReaderPage({ params }: { params: Promise<{ publicationId: string }> }) {
  const { publicationId } = await params;
  return (
    <LibraryReaderAccessBoundary publicationId={publicationId}>
      <LibraryReaderSurface publicationId={publicationId} />
      <LibraryResearchShortcut />
      <LibraryDiscussPassageLauncher publicationId={publicationId} />
    </LibraryReaderAccessBoundary>
  );
}
