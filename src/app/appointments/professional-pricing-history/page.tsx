import type { Metadata } from "next";
import Link from "next/link";
import ProfessionalBookingPriceHistoryCard from "@/components/professional-booking-price-history-card";

export const metadata: Metadata = {
  title: "Saved Professional Booking Quotes",
  description:
    "Review immutable request-time Professional Booking price quotes for Loombus appointments.",
  robots: { index: false, follow: false },
};

export default function ProfessionalBookingPriceHistoryPage() {
  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[78rem]">
        <nav className="mb-7 border-b border-[color:var(--loombus-border)] pb-4" aria-label="Saved Professional Booking quotes">
          <Link
            href="/appointments"
            className="inline-flex min-h-11 items-center border-b border-[color:var(--loombus-border)] px-1 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] motion-reduce:transition-none"
          >
            Back to Appointments
          </Link>
        </nav>
        <ProfessionalBookingPriceHistoryCard />
      </div>
    </main>
  );
}
