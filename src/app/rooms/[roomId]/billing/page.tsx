import type { Metadata } from "next";
import RoomBillingClient from "./room-billing-client";

export const metadata: Metadata = {
  title: "Room Billing | Loombus",
  description: "Manage a private Loombus Room subscription, plan, payment method, invoices, and usage.",
  robots: { index: false, follow: false },
};

export default function RoomBillingPage() {
  return <RoomBillingClient />;
}
