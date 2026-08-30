import type { Metadata } from "next";
import Link from "next/link";
import ProfessionalBookingIntakeCard from "@/components/professional-booking-intake-card";

export const metadata: Metadata = {
  title: "Professional Booking Client Intake",
  description:
    "Configure Premium Pro client intake questions for Loombus appointment services.",
  robots: { index: false, follow: false },
};

export default function ProfessionalBookingIntakePage() {
  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[78rem]">
        <nav className="mb-6 border-b border-[color:var(--loombus-border)] pb-4" aria-label="Professional Booking navigation">
          <Link
            href="/appointments"
            className="inline-flex min-h-11 items-center border-b border-transparent px-1 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold-soft)] motion-reduce:transition-none"
          >
            Back to Appointments
          </Link>
        </nav>
        <ProfessionalBookingIntakeCard />
      </div>
    </main>
  );
}
