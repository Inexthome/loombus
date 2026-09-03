import { LibraryBookClubHub } from "@/components/library/library-book-club-hub";
import "../../../library-publication-workflows-editorial.css";

export default async function LibraryBookClubPage({
  params,
}: {
  params: Promise<{ publicationId: string }>;
}) {
  const { publicationId } = await params;
  return <LibraryBookClubHub publicationId={publicationId} />;
}
