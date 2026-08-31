import type { Metadata } from "next";
import { AdminMemberCommerceEditorialFrame } from "../admin-member-commerce-editorial-frame";
import AdminAiAccessV2Client from "./ai-access-v2-client";
import "./ai-access-v2.css";
import "../member-commerce-editorial.css";

export const metadata: Metadata = {
  title: "AI Access Operations | Loombus Admin",
  description:
    "Admin workspace for reviewing Loombus AI entitlements and recent AI usage diagnostics.",
  robots: { index: false, follow: false },
};

export default function AdminAiAccessPage() {
  return (
    <AdminMemberCommerceEditorialFrame
      active="ai-access"
      title="AI access"
      description="Review member AI entitlements, plan-linked access, usage diagnostics, and administrative grants without turning entitlement work into a dashboard."
    >
      <AdminAiAccessV2Client />
    </AdminMemberCommerceEditorialFrame>
  );
}
