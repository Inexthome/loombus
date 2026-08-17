import { LibraryDiscussPassageLauncher } from "@/components/library/library-discuss-passage-launcher";
import { LibraryReaderSurface } from "@/components/library/library-reader-surface";

export default async function LibraryReaderPage({ params }: { params: Promise<{ publicationId: string }> }) {
  const { publicationId } = await params;
  return (
    <>
      <LibraryReaderSurface publicationId={publicationId} />
      <LibraryDiscussPassageLauncher publicationId={publicationId} />
    </>
  );
}
