import type { Metadata } from "next";
import { AdminMemberCommerceEditorialFrame } from "../admin-member-commerce-editorial-frame";
import AdminCommunicationsClient from "./communications-client";
import "../member-commerce-editorial.css";

export const metadata: Metadata = {
  title: "Member Communications | Loombus Admin",
  description: "Prepare, send, and audit role-protected Loombus member email campaigns.",
  robots: { index: false, follow: false },
};

export default function AdminCommunicationsPage() {
  return (
    <AdminMemberCommerceEditorialFrame
      active="communications"
      title="Member Communications"
      description="Prepare, review, send, and audit member email campaigns from the same editorial operations system used across Loombus Admin."
    >
      <AdminCommunicationsClient />
    </AdminMemberCommerceEditorialFrame>
  );
}
