import { notFound } from "next/navigation";
import { RoomCorePage } from "../room-core-page";

type CoreTool = "overview" | "discussions" | "calendar" | "announcements";
const CORE_TOOLS = new Set(["overview", "discussions", "calendar", "announcements"]);

export default async function DynamicRoomToolPage({ params }: { params: Promise<{ roomTool: string }> }) {
  const { roomTool } = await params;
  if (!CORE_TOOLS.has(roomTool)) notFound();
  return <RoomCorePage tool={roomTool as CoreTool} />;
}
