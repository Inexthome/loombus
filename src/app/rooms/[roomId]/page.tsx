import type { Metadata } from "next";
import { RoomDiscussionsWorkspace } from "@/components/room-discussions-workspace";
import { RoomResourcesWorkspace } from "@/components/room-resources-workspace";
import { RoomTierModulesWorkspace } from "@/components/room-tier-modules-workspace";
import RoomOptionOneClient from "../../room-option1/[roomId]/room-option1-client";
import "../../room-option1/[roomId]/room-option1.css";
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
  if (process.env.VERCEL_ENV === "preview") {
    return (
      <>
        <RoomTierModulesWorkspace />
        <RoomResourcesWorkspace />
        <RoomOptionOneClient />
        <RoomDiscussionsWorkspace />
      </>
    );
  }

  return (
    <>
      <LiveRoomWorkspaceClient />
      <RoomDiscussionsWorkspace />
    </>
  );
}
