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
    <main
      data-professional-booking-payments-editorial="route"
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[color:var(--loombus-text)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[78rem]">
        <header className="mb-8 border-b border-[color:var(--loombus-border)] pb-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">
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
              className="inline-flex min-h-11 items-center border-b border-[color:var(--loombus-border)] py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--loombus-page-bg)] motion-reduce:transition-none"
            >
              Back to Appointments
            </Link>
          </div>
        </header>
        <ProfessionalBookingPaymentCenter />
      </div>
    </main>
  );
}
