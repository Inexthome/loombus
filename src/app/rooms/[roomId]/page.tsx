import { redirect } from "next/navigation";

type RoomRedirectProps = {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ invite?: string }>;
};

export default async function RoomRedirectPage({ params, searchParams }: RoomRedirectProps) {
  const { roomId } = await params;
  const { invite } = await searchParams;
  const target = invite ? `/v2/rooms/${roomId}?invite=${encodeURIComponent(invite)}` : `/v2/rooms/${roomId}`;
  redirect(target);
}
