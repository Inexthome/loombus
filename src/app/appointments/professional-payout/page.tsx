import type { Metadata } from "next";
import Link from "next/link";
import ProfessionalBookingPayoutCard from "@/components/professional-booking-payout-card";

export const metadata: Metadata = {
  title: "Professional Booking Payout Setup",
  description:
    "Connect the shared Stripe Express payout identity used by Loombus Professional Booking.",
  robots: { index: false, follow: false },
};

export default function ProfessionalBookingPayoutPage() {
  return (
    <main
      data-professional-booking-payout-editorial="route"
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[78rem]">
        <nav
          className="mb-7 border-b border-[color:var(--loombus-border)] pb-4"
          aria-label="Professional Booking payout setup"
        >
          <Link
            href="/appointments"
            className="inline-flex min-h-11 items-center border-b border-[color:var(--loombus-border)] px-1 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--loombus-page-bg)] motion-reduce:transition-none"
          >
            Back to Appointments
          </Link>
        </nav>
        <ProfessionalBookingPayoutCard />
      </div>
    </main>
  );
}
