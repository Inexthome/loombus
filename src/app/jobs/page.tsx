import type { Metadata } from "next";
import JobsDirectoryPage from "@/components/jobs-directory-page";
import V2FeatureRouteShell from "@/components/v2-feature-route-shell";

export const metadata: Metadata = {
  title: "Jobs Directory | Loombus",
  description:
    "Discover approved job postings connected to attributable Loombus employer profiles and apply at the original employer source.",
};

export default function JobsPage() {
  return (
    <V2FeatureRouteShell>
      <JobsDirectoryPage />
    </V2FeatureRouteShell>
  );
}
