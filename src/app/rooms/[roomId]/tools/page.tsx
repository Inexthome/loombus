import type { Metadata } from "next";
import RoomToolsClient from "./room-tools-client";

export const metadata: Metadata = {
  title: "Room Search and Lifecycle | Loombus",
  description:
    "Search private Room content, export Room data, and manage archive, restore, and deletion controls.",
  robots: { index: false, follow: false },
};

export default function RoomToolsPage() {
  return <RoomToolsClient />;
}
