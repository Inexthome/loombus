import type { Metadata } from "next";
import IntelligentMatchingPage from "@/components/intelligent-matching-page";

export const metadata: Metadata = {
  title: "Intelligent Matching",
  description:
    "Review private Request-to-Service and Service-to-Request compatibility suggestions on Loombus.",
  robots: { index: false, follow: false },
};

export default function MatchesPage() {
  return <IntelligentMatchingPage />;
}
