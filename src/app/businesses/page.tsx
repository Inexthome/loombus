import type { Metadata } from "next";
import BusinessDirectoryPage from "@/components/business-directory-page";

export const metadata: Metadata = {
  title: "Local Business and Services | Loombus",
  description:
    "Discover approved local businesses, service areas, and current offerings through the Loombus signal-first directory.",
};

export default function BusinessesPage() {
  return (
    <div data-loombus-businesses-page>
      <BusinessDirectoryPage />
    </div>
  );
}
