import type { Metadata } from "next";
import ProtectedPartyReviewClient from "./protected-party-review-client";

export const metadata: Metadata = {
  title: "Protected Party Review | Loombus Admin",
  description:
    "Restricted privilege, reporter, victim, and unrelated-member minimization review metadata.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProtectedPartyReviewPage() {
  return (
    <div data-loombus-legal-protected-party-review>
      <ProtectedPartyReviewClient />
    </div>
  );
}
