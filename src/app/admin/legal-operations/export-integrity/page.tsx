import type { Metadata } from "next";
import ExportIntegrityClient from "./export-integrity-client";

export const metadata: Metadata = {
  title: "Export Integrity | Loombus Legal Operations",
  description: "Restricted Issue #674 chain-of-custody and export-integrity control metadata.",
  robots: { index: false, follow: false },
};

export default function ExportIntegrityPage() {
  return <ExportIntegrityClient />;
}
