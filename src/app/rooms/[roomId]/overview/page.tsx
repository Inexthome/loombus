import type { Metadata } from "next";
import RoomOverviewClient from "../room-overview-client";

export const metadata: Metadata = {
  title: "Room Overview | Loombus",
  description: "Private Room activity, dates, updates, and operating status.",
  robots: { index: false, follow: false },
};

export default function RoomOverviewPage() {
  return <RoomOverviewClient />;
}
