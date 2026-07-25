import type { Metadata } from "next";
import RoomAnalyticsClient from "./room-analytics-client";

export const metadata: Metadata = {
  title: "Room analytics | Loombus",
  description: "Review private Room analytics and operational health.",
  robots: { index: false, follow: false },
};

export default function RoomAnalyticsPage() {
  return <RoomAnalyticsClient />;
}
