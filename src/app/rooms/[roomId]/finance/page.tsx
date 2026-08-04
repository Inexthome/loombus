import type { Metadata } from "next";
import RoomFinanceClient from "./room-finance-client";

export const metadata: Metadata = {
  title: "Room Finance",
  description: "Private Room dues, invoices, balances, payments, and receipts.",
  robots: { index: false, follow: false },
};

export default function RoomFinancePage() {
  return <RoomFinanceClient />;
}