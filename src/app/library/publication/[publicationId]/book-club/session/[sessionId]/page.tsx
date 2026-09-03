import { LibraryBookClubDiscussion } from "@/components/library/library-book-club-discussion";
import "../../../../library-publication-workflows-editorial.css";

export default async function LibraryBookClubSessionDiscussionPage({
  params,
}: {
  params: Promise<{ publicationId: string; sessionId: string }>;
}) {
  const { publicationId, sessionId } = await params;
  return <LibraryBookClubDiscussion publicationId={publicationId} sessionId={sessionId} />;
}
