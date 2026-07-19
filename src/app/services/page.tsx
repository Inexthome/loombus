import type { Metadata } from "next";
import ServicesDirectoryPage from "@/components/services-directory-page";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Find accountable Services from Loombus members and businesses, send structured inquiries, connect Requests, and request appointments.",
  alternates: { canonical: "https://loombus.com/services" },
};

export default function ServicesPage() {
  return (
    <div data-loombus-services-page>
      <ServicesDirectoryPage />
    </div>
  );
}
