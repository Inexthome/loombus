import type { Metadata } from "next";
import RoomReservationsClient from "./room-reservations-client";

export const metadata: Metadata = {
  title: "Room Reservations | Loombus",
  description: "Reserve private Room facilities and shared resources.",
  robots: { index: false, follow: false },
};

export default function RoomReservationsPage() {
  return <RoomReservationsClient />;
}
