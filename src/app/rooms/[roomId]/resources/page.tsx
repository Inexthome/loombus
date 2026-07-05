import { redirect } from "next/navigation";

export default async function RoomResourcesRedirect({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  redirect(`/v2/rooms/${roomId}/resources`);
}
