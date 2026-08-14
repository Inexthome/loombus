import type { Metadata } from "next";
import Link from "next/link";
import ProfessionalBookingPaymentCenter from "@/components/professional-booking-payment-center";

export const metadata: Metadata = {
  title: "Professional Booking Payments",
  description:
    "Review Professional Booking payment authorizations, captures, releases, and refunds.",
  robots: { index: false, follow: false },
};

export default function ProfessionalBookingPaymentPage() {
  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[78rem]">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#b45309]">
              Premium Pro
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Professional Booking payments
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              Track the exact server-saved payment contract for paid Professional Booking requests. Stripe account identifiers and payment credentials are never exposed here.
            </p>
          </div>
          <Link
            href="/appointments"
            className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-2 text-sm font-semibold"
          >
            Back to Appointments
          </Link>
        </div>
        <ProfessionalBookingPaymentCenter />
      </div>
    </main>
  );
}
