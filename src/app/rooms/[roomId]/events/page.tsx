import type { Metadata } from "next";
import RoomWorkspaceSectionClient from "../room-workspace-section-client";

export const metadata: Metadata = {
  title: "Room Events | Loombus",
  robots: { index: false, follow: false },
};

export default function RoomEventsPage() {
  return <RoomWorkspaceSectionClient section="events" />;
}
