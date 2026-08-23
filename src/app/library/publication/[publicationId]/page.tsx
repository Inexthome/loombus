import { LibraryPublicationDetail } from "@/components/library/library-publication-detail";

export default async function LibraryPublicationDetailPage({
  params,
}: {
  params: Promise<{ publicationId: string }>;
}) {
  const { publicationId } = await params;
  return <LibraryPublicationDetail publicationId={publicationId} />;
}
