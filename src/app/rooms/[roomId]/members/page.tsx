import type { Metadata } from "next";
import RoomWorkspaceSectionClient from "../room-workspace-section-client";

export const metadata: Metadata = {
  title: "Room Members | Loombus",
  robots: { index: false, follow: false },
};

export default function RoomMembersPage() {
  return <RoomWorkspaceSectionClient section="members" />;
}
