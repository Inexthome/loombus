import type { Metadata } from "next";
import PlatformOperationsClient from "./platform-operations-client";

export const metadata: Metadata = {
  title: "Platform Operations | Loombus Admin",
  description:
    "Role-protected Marketplace, Business Directory, and Jobs moderation for Loombus administrators.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PlatformOperationsPage() {
  return <PlatformOperationsClient initialModule="overview" />;
}
