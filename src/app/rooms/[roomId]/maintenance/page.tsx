import type { Metadata } from "next";
import RoomMaintenanceClient from "./room-maintenance-client";

export const metadata: Metadata = {
  title: "Room Maintenance",
  description: "Submit and track private Room maintenance requests.",
  robots: { index: false, follow: false },
};

export default function RoomMaintenancePage() {
  return <RoomMaintenanceClient />;
}
