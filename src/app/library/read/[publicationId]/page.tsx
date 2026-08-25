import { redirect } from "next/navigation";
import { LibraryDiscussPassageLauncher } from "@/components/library/library-discuss-passage-launcher";
import { LibraryReaderAccessBoundary } from "@/components/library/library-reader-access-boundary";
import { LibraryReaderModernization } from "@/components/library/library-reader-modernization";
import { LibraryReaderPassageReturnBoundary } from "@/components/library/library-reader-passage-return-boundary";
import { LibraryReaderSurface } from "@/components/library/library-reader-surface";
import { LibraryResearchShortcut } from "@/components/library/library-research-shortcut";

function parseOffset(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export default async function LibraryReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicationId: string }>;
  searchParams: Promise<{ open?: string; locator?: string; start?: string; end?: string; sha?: string }>;
}) {
  const { publicationId } = await params;
  const query = await searchParams;

  if (query.open !== "1") redirect(`/library/read/${encodeURIComponent(publicationId)}?open=1`);

  const startOffset = parseOffset(query.start);
  const endOffset = parseOffset(query.end);
  const focus =
    query.locator &&
    startOffset !== null &&
    endOffset !== null &&
    endOffset > startOffset &&
    query.sha &&
    /^[a-f0-9]{64}$/i.test(query.sha)
      ? { locator: query.locator, startOffset, endOffset, textSha256: query.sha.toLowerCase() }
      : null;

  return (
    <LibraryReaderAccessBoundary publicationId={publicationId}>
      <LibraryReaderPassageReturnBoundary publicationId={publicationId} focus={focus}>
        <LibraryReaderModernization />
        <LibraryReaderSurface publicationId={publicationId} />
        <LibraryResearchShortcut />
        <LibraryDiscussPassageLauncher publicationId={publicationId} />
      </LibraryReaderPassageReturnBoundary>
    </LibraryReaderAccessBoundary>
  );
}
