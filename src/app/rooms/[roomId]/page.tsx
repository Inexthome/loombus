import type { Metadata } from "next";
import RoomHomeWorkspaceClient from "./room-home-workspace-client";

export const metadata: Metadata = {
  title: "Private Room | Loombus",
  description:
    "A private Loombus Room for verified members, structured discussions, announcements, roles, and shared events.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RoomWorkspacePage() {
  return <RoomHomeWorkspaceClient />;
}
