import type { Metadata } from "next";
import JobsManagerPage from "@/components/jobs-manager-page";

export const metadata: Metadata = {
  title: "Manage Jobs | Loombus",
  description:
    "Create, review, close, and manage attributable job postings connected to Loombus business profiles.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ManageJobsPage() {
  return <JobsManagerPage />;
}
