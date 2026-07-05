import { redirect } from "next/navigation";

type RoomInviteRedirectProps = {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ invite?: string }>;
};

export default async function RoomInviteRedirectPage({ params, searchParams }: RoomInviteRedirectProps) {
  const { roomId } = await params;
  const { invite } = await searchParams;
  const target = invite ? `/v2/rooms/${roomId}/invite?invite=${encodeURIComponent(invite)}` : `/v2/rooms/${roomId}/invite`;
  redirect(target);
}
