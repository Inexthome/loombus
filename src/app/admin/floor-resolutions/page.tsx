import type { Metadata } from "next";
import AdminFloorResolutionsClient from "@/components/admin-floor-resolutions-client";

export const metadata: Metadata = {
  title: "Floor Call Resolutions | Loombus Admin",
  description:
    "Role-protected review queue for The Floor's calls resolver -- approve or reject a proposed outcome before it stamps a member's public track record.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminFloorResolutionsPage() {
  return <AdminFloorResolutionsClient />;
}
