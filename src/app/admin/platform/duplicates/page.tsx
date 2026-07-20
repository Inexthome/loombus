import type { Metadata } from "next";
import DuplicateReviewClient from "../duplicate-review-client";

export const metadata: Metadata = {
  title: "Media Duplicate Review | Loombus Admin",
  description:
    "Administrator-only exact media fingerprint review for public Loombus platform content.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MediaDuplicateReviewPage() {
  return <DuplicateReviewClient />;
}
