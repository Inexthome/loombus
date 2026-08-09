import type { Metadata } from "next";
import LegalDataMapClient from "./legal-data-map-client";

export const metadata: Metadata = {
  title: "Legal Data Map | Loombus Admin",
  description:
    "Restricted metadata-only Legal Operations map of systems where potentially responsive data may exist.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LegalDataMapPage() {
  return (
    <div data-loombus-legal-data-map>
      <LegalDataMapClient />
    </div>
  );
}
