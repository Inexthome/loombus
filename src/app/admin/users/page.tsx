import type { Metadata } from "next";
import { AdminMemberCommerceEditorialFrame } from "../admin-member-commerce-editorial-frame";
import AdminUsersV2Client from "./admin-users-v2-client";
import "./admin-users-v2.css";
import "../member-commerce-editorial.css";

export const metadata: Metadata = {
  title: "Members | Loombus Admin",
  description:
    "Admin member operations workspace for account access, identity review, age safety, profile readiness, plans, and billing references.",
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return (
    <AdminMemberCommerceEditorialFrame
      active="users"
      title="Members"
      description="Review member identity, account state, profile readiness, age-safety signals, plans, and billing references from one focused operational record."
    >
      <AdminUsersV2Client />
    </AdminMemberCommerceEditorialFrame>
  );
}
