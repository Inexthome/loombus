import type { Metadata } from "next";
import CalendarPage from "@/components/calendar-page";

export const metadata: Metadata = {
  title: "My Calendar",
  description: "Review your public Events, private Room dates, and Appointments in one Loombus calendar.",
  robots: { index: false, follow: false },
};

export default function MyCalendarPage() {
  return <CalendarPage />;
}
