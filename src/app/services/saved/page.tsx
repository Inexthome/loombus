import type { Metadata } from "next";
import ServicesSavedPage from "@/components/services-saved-page";
import "../services-editorial.css";

export const metadata: Metadata = {
  title: "Saved Services",
  description: "Review Services you saved on Loombus.",
  robots: { index: false, follow: false },
};

export default function SavedServicesPage() {
  return <ServicesSavedPage />;
}
