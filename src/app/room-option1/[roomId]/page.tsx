import type { Metadata } from "next";
import { RoomDiscussionsWorkspace } from "@/components/room-discussions-workspace";
import RoomOptionOneClient from "./room-option1-client";

export const metadata: Metadata = {
  title: "Room Option 1 Preview | Loombus",
  description: "A functional preview of the classic discussion-first Loombus Room workspace.",
  robots: { index: false, follow: false },
};

export default function RoomOptionOnePage() {
  return (
    <>
      <RoomOptionOneClient />
      <RoomDiscussionsWorkspace />
    </>
  );
}
