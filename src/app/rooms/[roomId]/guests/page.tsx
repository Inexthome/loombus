import type { Metadata } from "next";
import RoomGuestsClient from "./room-guests-client";

export const metadata: Metadata = {
  title: "Room Guests",
  description: "Private visitor and guest-pass management for a Loombus Room.",
  robots: { index: false, follow: false },
};

export default function RoomGuestsPage() {
  return <RoomGuestsClient />;
}
