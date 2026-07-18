import type { Metadata } from "next";
import ServicesManagerPage from "@/components/services-manager-page";

export const metadata: Metadata = {
  title: "Manage Services",
  description: "Create and manage Loombus Services and inquiries.",
  robots: { index: false, follow: false },
};

export default function ManageServicesPage() {
  return <ServicesManagerPage />;
}
