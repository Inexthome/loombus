import type { Metadata } from "next";
import { RoomDiscussionsWorkspace } from "@/components/room-discussions-workspace";
import LiveRoomWorkspaceClient from "./live-room-workspace-client";

export const metadata: Metadata = {
  title: "Private Room | Loombus",
  description:
    "A private Loombus room for verified members, structured discussions, announcements, roles, and shared calendar events.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RoomWorkspacePage() {
  return (
    <>
      <LiveRoomWorkspaceClient />
      <RoomDiscussionsWorkspace />
    </>
  );
}
