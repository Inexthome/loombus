import type { Metadata } from "next";
import RoomsDirectoryV3 from "@/components/rooms-directory-v3";

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
  return <RoomsDirectoryV3 />;
}
