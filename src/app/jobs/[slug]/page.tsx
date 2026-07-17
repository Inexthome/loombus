import type { Metadata } from "next";
import JobProfilePage from "@/components/job-profile-page";

export const metadata: Metadata = {
  title: "Job Posting | Loombus",
  description:
    "Review a structured job posting, employer identity, compensation details, application deadline, and original application source on Loombus.",
};

export default function JobPage() {
  return <JobProfilePage />;
}
