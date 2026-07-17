import type { Metadata } from "next";
import EventsManagerPage from "@/components/events-manager-page";

export const metadata: Metadata = {
  title: "Manage Events",
  description: "Create and manage attributable Loombus Events.",
  robots: { index: false, follow: false },
};

export default function ManageEventsPage() {
  return <EventsManagerPage />;
}
