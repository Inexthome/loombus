import type { Metadata } from "next";
import LegalOperationsClient from "./legal-operations-client";

export const metadata: Metadata = {
  title: "Legal Operations | Loombus Admin",
  description: "Restricted legal-request and preservation operations workspace.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LegalOperationsPage() {
  return (
    <div data-loombus-legal-operations>
      <LegalOperationsClient />
    </div>
  );
}
