import type { Metadata } from "next";
import RoomWorkspaceSectionClient from "../room-workspace-section-client";

export const metadata: Metadata = {
  title: "Room Announcements | Loombus",
  robots: { index: false, follow: false },
};

export default function RoomAnnouncementsPage() {
  return <RoomWorkspaceSectionClient section="announcements" />;
}
