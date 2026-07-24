import type { Metadata } from "next";
import RoomModerationClient from "./room-moderation-client";

export const metadata: Metadata = {
  title: "Room Moderation | Loombus",
  description: "Report Room content and manage Room moderation reviews.",
  robots: { index: false, follow: false },
};

export default function RoomModerationPage() {
  return <RoomModerationClient />;
}
