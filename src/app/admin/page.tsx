import type { Metadata } from "next";
import AdminOperationsClient from "./admin-operations-client";
import "./admin-operations.css";

export const metadata: Metadata = {
  title: "Loombus Admin Operations Center | Loombus",
  description:
    "Role-protected operational overview for Loombus moderation, support, member access, billing, Labs, and platform diagnostics.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminDashboardPage() {
  return <AdminOperationsClient />;
}
