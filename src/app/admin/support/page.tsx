import type { Metadata } from "next";
import AdminSupportV2Client from "./support-v2-client";
import "./support-v2.css";

export const metadata: Metadata = {
  title: "Support Operations | Loombus Admin",
  description: "Admin workspace for reviewing and resolving Loombus support requests.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminSupportPage() {
  return <AdminSupportV2Client />;
}
