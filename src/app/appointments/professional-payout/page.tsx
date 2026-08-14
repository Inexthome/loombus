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
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[78rem]">
        <div className="mb-5">
          <Link
            href="/appointments"
            className="inline-flex rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]"
          >
            Back to Appointments
          </Link>
        </div>
        <ProfessionalBookingPayoutCard />
      </div>
    </main>
  );
}
