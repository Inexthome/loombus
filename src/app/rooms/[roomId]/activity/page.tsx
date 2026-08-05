import type { Metadata } from "next";
import RoomActivityClient from "./room-activity-client";

export const metadata: Metadata = {
  title: "Room Activity | Loombus",
  description: "Review the private operational timeline for a Loombus Room.",
  robots: { index: false, follow: false },
};

export default function RoomActivityPage() {
  return <RoomActivityClient />;
}
