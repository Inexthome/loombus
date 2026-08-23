import { redirect } from "next/navigation";
import { LibraryDiscussPassageLauncher } from "@/components/library/library-discuss-passage-launcher";
import { LibraryReaderAccessBoundary } from "@/components/library/library-reader-access-boundary";
import { LibraryReaderSurface } from "@/components/library/library-reader-surface";
import { LibraryResearchShortcut } from "@/components/library/library-research-shortcut";

export default async function LibraryReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicationId: string }>;
  searchParams: Promise<{ open?: string }>;
}) {
  const { publicationId } = await params;
  const { open } = await searchParams;

  if (open !== "1") redirect(`/library/publication/${publicationId}`);

  return (
    <LibraryReaderAccessBoundary publicationId={publicationId}>
      <LibraryReaderSurface publicationId={publicationId} />
      <LibraryResearchShortcut />
      <LibraryDiscussPassageLauncher publicationId={publicationId} />
    </LibraryReaderAccessBoundary>
  );
}
