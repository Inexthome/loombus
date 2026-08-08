import type { Metadata } from "next";
import DisclosurePreparationClient from "./disclosure-preparation-client";

export const metadata: Metadata = {
  title: "Disclosure Preparation | Loombus Admin",
  description: "Restricted draft disclosure metadata and least-data manifest preparation.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DisclosurePreparationPage() {
  return (
    <div data-loombus-legal-disclosure-preparation>
      <DisclosurePreparationClient />
    </div>
  );
}
