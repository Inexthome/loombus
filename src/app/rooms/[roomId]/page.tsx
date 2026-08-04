import type { Metadata } from "next";
import RoomDashboardClient from "./room-dashboard-client";

export const metadata: Metadata = {
  title: "Room Dashboard | Loombus",
  description: "Private operational overview for a Loombus Room.",
  robots: { index: false, follow: false },
};

export default function RoomWorkspacePage() {
  return <RoomDashboardClient />;
}
