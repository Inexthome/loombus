import { LibraryPublicationCommerceBoundary } from "@/components/library/library-publication-commerce-boundary";
import { LibraryPublicationDetail } from "@/components/library/library-publication-detail";
import "../../library-publication-workflows-editorial.css";

export default async function LibraryPublicationDetailPage({
  params,
}: {
  params: Promise<{ publicationId: string }>;
}) {
  const { publicationId } = await params;
  return (
    <div data-library-publication-editorial>
      <LibraryPublicationCommerceBoundary publicationId={publicationId}>
        <LibraryPublicationDetail publicationId={publicationId} />
      </LibraryPublicationCommerceBoundary>
    </div>
  );
}
