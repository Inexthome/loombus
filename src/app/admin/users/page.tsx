import type { Metadata } from "next";
import AdminUsersV2Client from "./admin-users-v2-client";
import "./admin-users-v2.css";

export const metadata: Metadata = {
  title: "Members | Loombus Admin",
  description:
    "Admin member operations workspace for account access, identity review, age safety, profile readiness, plans, and billing references.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminUsersPage() {
  return <AdminUsersV2Client />;
}
