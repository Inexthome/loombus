import type { Metadata } from "next";
import RoomCalendarClient from "./room-calendar-client";

export const metadata: Metadata = {
  title: "Room calendar | Loombus",
  description: "Manage private Room events, recurring schedules, and RSVPs.",
  robots: { index: false, follow: false },
};

export default function RoomCalendarPage() {
  return <RoomCalendarClient />;
}
