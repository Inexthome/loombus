import type { Metadata } from "next";
import BusinessManagerPage from "@/components/business-manager-page";

export const metadata: Metadata = {
  title: "Manage Business Listings | Loombus",
  description:
    "Create, claim, update, and review Local Business and Services listings on Loombus.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BusinessManagePage() {
  return <BusinessManagerPage />;
}
