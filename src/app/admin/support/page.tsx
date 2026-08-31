import type { Metadata } from "next";
import { AdminMemberCommerceEditorialFrame } from "../admin-member-commerce-editorial-frame";
import AdminSupportV2Client from "./support-v2-client";
import "./support-v2.css";
import "../member-commerce-editorial.css";

export const metadata: Metadata = {
  title: "Support Operations | Loombus Admin",
  description: "Admin workspace for reviewing and resolving Loombus support requests.",
  robots: { index: false, follow: false },
};

export default function AdminSupportPage() {
  return (
    <AdminMemberCommerceEditorialFrame
      active="support"
      title="Support"
      description="Review support requests, member context, internal notes, status, and resolution work in one continuous support record."
    >
      <AdminSupportV2Client />
    </AdminMemberCommerceEditorialFrame>
  );
}
