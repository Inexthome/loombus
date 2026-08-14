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
        <div className="mb-5">
          <Link
            href="/appointments"
            className="inline-flex rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]"
          >
            Back to Appointments
          </Link>
        </div>
        <ProfessionalBookingIntakeCard />
      </div>
    </main>
  );
}
