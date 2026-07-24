import type { Metadata } from "next";
import RoomRetentionClient from "./room-retention-client";

export const metadata: Metadata = {
  title: "Room Retention | Loombus",
  description: "Preview and stage Room retention cleanup safely.",
  robots: { index: false, follow: false },
};

export default function RoomRetentionPage() {
  return <RoomRetentionClient />;
}
