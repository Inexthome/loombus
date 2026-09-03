import { redirect } from "next/navigation";

export default async function BookClubDiscussionCreatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const target = new URLSearchParams();
  const publicationId = params.libraryPublicationId;
  const sessionId = params.bookClubSessionId;
  if (typeof publicationId === "string") target.set("libraryPublicationId", publicationId);
  if (typeof sessionId === "string") target.set("bookClubSessionId", sessionId);
  redirect(`/create${target.size ? `?${target.toString()}` : ""}`);
}
