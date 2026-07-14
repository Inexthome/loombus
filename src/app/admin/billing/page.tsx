import type { Metadata } from "next";
import AdminBillingV2Client from "./billing-v2-client";
import "./billing-v2.css";

export const metadata: Metadata = {
  title: "Billing Operations | Loombus Admin",
  description:
    "Review Loombus billing configuration, subscription synchronization, Extra AI Packs, and credit-ledger activity.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminBillingPage() {
  return <AdminBillingV2Client />;
}
