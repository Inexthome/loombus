import { notFound } from "next/navigation";
import { RoomCorePage } from "../room-core-page";
import { RoomRequestsPage } from "../room-requests-page";

type CoreTool = "overview" | "discussions" | "calendar" | "announcements";
const CORE_TOOLS = new Set(["overview", "discussions", "calendar", "announcements"]);
const STANDALONE_TOOLS = new Set(["requests"]);

export default async function DynamicRoomToolPage({ params }: { params: Promise<{ roomTool: string }> }) {
  const { roomTool } = await params;
  if (roomTool === "requests") return <RoomRequestsPage />;
  if (!CORE_TOOLS.has(roomTool) && !STANDALONE_TOOLS.has(roomTool)) notFound();
  return <RoomCorePage tool={roomTool as CoreTool} />;
}
