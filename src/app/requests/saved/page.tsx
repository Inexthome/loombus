import type { Metadata } from "next";
import RequestsSavedPage from "@/components/requests-saved-page";

export const metadata: Metadata = {
  title: "Saved Requests",
  description: "Review public Loombus Requests you saved.",
  robots: { index: false, follow: false },
};

export default function SavedRequestsPage() {
  return <RequestsSavedPage />;
}
