import type { Metadata } from "next";
import { AdminMemberCommerceEditorialFrame } from "../admin-member-commerce-editorial-frame";
import AdminBillingV2Client from "./billing-v2-client";
import "./billing-v2.css";
import "./billing-v2-appearance.css";
import "../member-commerce-editorial.css";

export const metadata: Metadata = {
  title: "Billing Operations | Loombus Admin",
  description:
    "Review Loombus billing configuration, subscription synchronization, Extra AI Packs, and credit-ledger activity.",
  robots: { index: false, follow: false },
};

export default function AdminBillingPage() {
  return (
    <AdminMemberCommerceEditorialFrame
      active="billing"
      title="Billing"
      description="Inspect subscription synchronization, billing configuration, Extra AI Pack fulfillment, and credit-ledger activity in a focused operational workspace."
    >
      <AdminBillingV2Client />
    </AdminMemberCommerceEditorialFrame>
  );
}
