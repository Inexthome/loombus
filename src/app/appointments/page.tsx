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

export default function AppointmentsPage() {
  return (
    <>
      <div className="bg-[color:var(--loombus-page-bg)] px-4 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[78rem]">
          <UnifiedAppointmentsOverview />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Link
              href="/appointments/professional-pricing"
              className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]"
            >
              Premium Pro service pricing
            </Link>
            <Link
              href="/appointments/professional-policy"
              className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]"
            >
              Premium Pro booking policies
            </Link>
            <Link
              href="/appointments/professional-intake-responses"
              className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]"
            >
              Client intake responses
            </Link>
            <Link
              href="/appointments/professional-intake"
              className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]"
            >
              Premium Pro client intake
            </Link>
          </div>
        </div>
      </div>
      <AppointmentsManagerPage />
    </>
  );
}
