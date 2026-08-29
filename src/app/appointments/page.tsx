import type { Metadata } from "next";
import Link from "next/link";
import AppointmentsManagerPage from "@/components/appointments-manager-page";
import UnifiedAppointmentsOverview from "@/components/unified-appointments-overview";

export const metadata: Metadata = {
  title: "Appointments",
  description:
    "Manage your Loombus appointments, Marketplace pickups, Room reservations, and business appointment services.",
  robots: { index: false, follow: false },
};

const professionalTools = [
  ["Professional Booking payments", "/appointments/professional-payment"],
  ["Premium Pro payout setup", "/appointments/professional-payout"],
  ["Saved Professional quotes", "/appointments/professional-pricing-history"],
  ["Premium Pro service pricing", "/appointments/professional-pricing"],
  ["Premium Pro booking policies", "/appointments/professional-policy"],
  ["Client intake responses", "/appointments/professional-intake-responses"],
  ["Premium Pro client intake", "/appointments/professional-intake"],
] as const;

export default function AppointmentsPage() {
  return (
    <>
      <div
        data-appointments-editorial="route"
        className="bg-[color:var(--loombus-page-bg)] px-4 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-[78rem]">
          <UnifiedAppointmentsOverview />
          <section className="mb-8 border-b border-[color:var(--loombus-border)] pb-5" aria-labelledby="professional-tools-heading">
            <p
              id="professional-tools-heading"
              className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]"
            >
              Professional Booking tools
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {professionalTools.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="min-h-10 border-b border-[color:var(--loombus-border)] py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)]"
                >
                  {label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
      <AppointmentsManagerPage />
    </>
  );
}
