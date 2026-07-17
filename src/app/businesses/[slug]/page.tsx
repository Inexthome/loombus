import type { Metadata } from "next";
import BusinessProfilePage from "@/components/business-profile-page";

export const metadata: Metadata = {
  title: "Business Profile | Loombus",
  description:
    "Review a local business profile, service area, current offerings, and accountability information on Loombus.",
};

export default function BusinessPage() {
  return <BusinessProfilePage />;
}
