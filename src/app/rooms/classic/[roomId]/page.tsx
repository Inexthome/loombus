import type { Metadata } from "next";
import { RoomDiscussionsWorkspace } from "@/components/room-discussions-workspace";
import ClassicRoomPreviewClient from "./classic-room-preview-client";
import "./classic-room-preview.css";

export const metadata: Metadata = {
  title: "Classic Room Preview | Loombus",
  description:
    "An isolated preview of the discussion-first classic sidebar Room experience.",
  robots: { index: false, follow: false },
};

export default function ClassicRoomPreviewPage() {
  return (
    <>
      <ClassicRoomPreviewClient />
      <RoomDiscussionsWorkspace />
    </>
  );
}
