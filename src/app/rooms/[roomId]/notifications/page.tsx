import type { Metadata } from "next";
import RoomNotificationsClient from "./room-notifications-client";

export const metadata: Metadata = {
  title: "Room notifications | Loombus",
  description: "Manage Room activity notifications and email digests.",
  robots: { index: false, follow: false },
};

export default function RoomNotificationsPage() {
  return <RoomNotificationsClient />;
}
