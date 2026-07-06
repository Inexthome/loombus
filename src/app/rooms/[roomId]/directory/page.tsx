import { redirect } from "next/navigation";

export default async function RoomDirectoryRedirect({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  redirect(`/v2/rooms/${roomId}/directory`);
}
