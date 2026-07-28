import type { Metadata } from "next";
import TrustSafetyCasesClient from "./trust-safety-cases-client";

export const metadata: Metadata = {
  title: "Trust and Safety Cases | Loombus Admin",
  description: "Restricted Trust and Safety case records and handling history.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TrustSafetyCasesPage() {
  return <TrustSafetyCasesClient />;
}
