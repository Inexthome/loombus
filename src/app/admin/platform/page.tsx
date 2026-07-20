import type { Metadata } from "next";
import PlatformOverviewClient from "./platform-overview-client";

export const metadata: Metadata = {
  title: "Platform Operations | Loombus Admin",
  description:
    "Role-protected operational summaries and module navigation for Marketplace, Businesses, Jobs, Events, Requests, Services, Rooms, Appointments, Local, Matches, and Search.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PlatformOperationsPage() {
  return <PlatformOverviewClient />;
}
