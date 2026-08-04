import type { Metadata } from "next";
import RoomAnalyticsClient from "./room-analytics-client";
import RoomOperationsInsights from "./room-operations-insights";

export const metadata: Metadata = {
  title: "Room analytics | Loombus",
  description: "Review private Room analytics and operational health.",
  robots: { index: false, follow: false },
};

export default function RoomAnalyticsPage() {
  return (
    <>
      <RoomAnalyticsClient />
      <div className="rooms-live-shell mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <RoomOperationsInsights />
      </div>
    </>
  );
}
