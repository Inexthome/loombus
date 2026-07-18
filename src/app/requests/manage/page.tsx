import type { Metadata } from "next";
import RequestsManagerPage from "@/components/requests-manager-page";

export const metadata: Metadata = {
  title: "Manage Requests",
  description: "Create and manage public Loombus Requests and responses.",
  robots: { index: false, follow: false },
};

export default function ManageRequestsPage() {
  return <RequestsManagerPage />;
}
