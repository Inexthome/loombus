import { notFound, redirect } from "next/navigation";

const CORE_TOOLS = new Set(["overview", "discussions", "calendar", "announcements"]);

export default async function RoomToolRedirect({ params }: { params: Promise<{ roomId: string; roomTool: string }> }) {
  const { roomId, roomTool } = await params;
  if (!CORE_TOOLS.has(roomTool)) notFound();
  redirect(`/v2/rooms/${roomId}/${roomTool}`);
}
