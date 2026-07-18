import type { Metadata } from "next";
import PlatformOperationsClient from "./platform-operations-client";

export const metadata: Metadata = {
  title: "Platform Operations | Loombus Admin",
  description:
    "Role-protected moderation and operational oversight for Marketplace, Business Directory, Jobs, Events, Requests, Services, Rooms, Appointments, Local, and Matches.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PlatformOperationsPage() {
  return <PlatformOperationsClient initialModule="overview" />;
}
