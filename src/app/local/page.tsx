import type { Metadata } from "next";
import LocalDiscoveryPage from "@/components/local-discovery-page";

export const metadata: Metadata = {
  title: "Loombus Local",
  description:
    "Discover attributable businesses, Services, Events, Jobs, Marketplace listings, and Requests by place, distance, date, and availability.",
  alternates: { canonical: "https://loombus.com/local" },
};

export default function LocalPage() {
  return (
    <div data-loombus-local-page>
      <LocalDiscoveryPage />
    </div>
  );
}
