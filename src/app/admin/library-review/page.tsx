import type { Metadata } from "next";
import AdminLibraryReviewClient from "@/components/admin-library-review-client";

export const metadata: Metadata = {
  title: "Library Review | Loombus Admin",
  description:
    "Role-protected editorial review queue for submitted Loombus Library publications.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLibraryReviewPage() {
  return <AdminLibraryReviewClient />;
}
