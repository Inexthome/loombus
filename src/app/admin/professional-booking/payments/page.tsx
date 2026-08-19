import type { Metadata } from "next";
import ProfessionalBookingPaymentOperationsClient from "./professional-booking-payment-operations-client";

export const metadata: Metadata = {
  title: "Professional Booking Payments | Loombus Admin",
  description:
    "Read-only operational visibility for Professional Booking authorizations, captures, refunds, disputes, and reconciliation attention.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfessionalBookingPaymentOperationsPage() {
  return <ProfessionalBookingPaymentOperationsClient />;
}
