import type { Metadata } from "next";
import RoomWorkspaceSectionClient from "./room-workspace-section-client";

export const metadata: Metadata = {
  title: "Room Discussions | Loombus",
  description:
    "Private structured discussions for verified members of a Loombus Room.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RoomWorkspacePage() {
  // The base Room route intentionally lands on Discussions.
  return <RoomWorkspaceSectionClient section="discussions" />;
}
