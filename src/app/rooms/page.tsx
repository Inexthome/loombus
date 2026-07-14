import type { Metadata } from "next";
import LiveRoomsClient from "./live-rooms-client";

export const metadata: Metadata = {
  title: "Private Rooms | Loombus",
  description:
    "Enter verified private Loombus rooms for structured discussions, announcements, members, and shared calendar events.",
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "https://loombus.com/rooms",
  },
};

export default function RoomsPage() {
  return <LiveRoomsClient />;
}
