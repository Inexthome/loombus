import type { Metadata } from "next";
import { AdminMemberCommerceEditorialFrame } from "../../admin-member-commerce-editorial-frame";
import ProfessionalBookingPaymentOperationsClient from "./professional-booking-payment-operations-client";
import "../../member-commerce-editorial.css";

export const metadata: Metadata = {
  title: "Professional Booking Payments | Loombus Admin",
  description:
    "Read-only operational visibility for Professional Booking authorizations, captures, refunds, disputes, and reconciliation attention.",
  robots: { index: false, follow: false },
};

export default function ProfessionalBookingPaymentOperationsPage() {
  return (
    <AdminMemberCommerceEditorialFrame
      active="booking-payments"
      title="Booking payments"
      description="Review Professional Booking authorization, capture, refund, reconciliation, and dispute state in a read-only operations workspace."
    >
      <ProfessionalBookingPaymentOperationsClient />
    </AdminMemberCommerceEditorialFrame>
  );
}
