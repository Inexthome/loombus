import type { Metadata } from "next";
import CommerceIntegrityClient from "./commerce-integrity-client";

export const metadata: Metadata = {
  title: "Commerce Integrity Review | Loombus Admin",
  description:
    "Restricted manual commerce and professional-integrity classification workspace for Loombus Platform Operations.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CommerceIntegrityReviewPage() {
  return <CommerceIntegrityClient />;
}
