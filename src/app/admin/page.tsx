import type { Metadata } from "next";
import Link from "next/link";
import AdminOperationsClient from "./admin-operations-client";
import "./admin-operations.css";

export const metadata: Metadata = {
  title: "Loombus Admin Operations Center | Loombus",
  description:
    "Role-protected operational overview for Loombus moderation, support, member access, billing, Labs, and platform diagnostics.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminDashboardPage() {
  return (
    <>
      <nav
        className="mx-auto flex w-full max-w-[1480px] flex-wrap justify-end gap-2 px-4 pt-4 sm:px-6"
        aria-label="Admin operations shortcuts"
      >
        <Link
          href="/admin/library-review"
          className="inline-flex items-center justify-center rounded-full bg-[#CBAB5B] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-105"
        >
          Open Library Review
        </Link>
        <Link
          href="/admin/legal-operations"
          className="inline-flex items-center justify-center rounded-full border border-[#CBAB5B]/50 px-5 py-3 text-sm font-semibold transition hover:border-[#CBAB5B] hover:bg-[#CBAB5B]/10"
          style={{ color: "var(--loombus-text-strong, #18181b)" }}
        >
          Open Legal Operations
        </Link>
        <Link
          href="/admin/legal-operations/disclosure-preparation"
          className="inline-flex items-center justify-center rounded-full border border-[#CBAB5B]/50 px-5 py-3 text-sm font-semibold transition hover:border-[#CBAB5B] hover:bg-[#CBAB5B]/10"
          style={{ color: "var(--loombus-text-strong, #18181b)" }}
        >
          Open Disclosure Preparation
        </Link>
        <Link
          href="/admin/legal-operations/protected-party-review"
          className="inline-flex items-center justify-center rounded-full border border-[#CBAB5B]/50 px-5 py-3 text-sm font-semibold transition hover:border-[#CBAB5B] hover:bg-[#CBAB5B]/10"
          style={{ color: "var(--loombus-text-strong, #18181b)" }}
        >
          Open Protected Party Review
        </Link>
        <Link
          href="/admin/legal-operations/data-map"
          className="inline-flex items-center justify-center rounded-full border border-[#CBAB5B]/50 px-5 py-3 text-sm font-semibold transition hover:border-[#CBAB5B] hover:bg-[#CBAB5B]/10"
          style={{ color: "var(--loombus-text-strong, #18181b)" }}
        >
          Open Legal Data Map
        </Link>
        <Link
          href="/admin/legal-operations/export-integrity"
          className="inline-flex items-center justify-center rounded-full border border-[#CBAB5B]/50 px-5 py-3 text-sm font-semibold transition hover:border-[#CBAB5B] hover:bg-[#CBAB5B]/10"
          style={{ color: "var(--loombus-text-strong, #18181b)" }}
        >
          Open Export Integrity
        </Link>
        <Link
          href="/admin/legal-operations/retention"
          className="inline-flex items-center justify-center rounded-full border border-[#CBAB5B]/50 px-5 py-3 text-sm font-semibold transition hover:border-[#CBAB5B] hover:bg-[#CBAB5B]/10"
          style={{ color: "var(--loombus-text-strong, #18181b)" }}
        >
          Open Legal Retention
        </Link>
        <Link
          href="/admin/legal-operations/transparency-reporting"
          className="inline-flex items-center justify-center rounded-full border border-[#CBAB5B]/50 px-5 py-3 text-sm font-semibold transition hover:border-[#CBAB5B] hover:bg-[#CBAB5B]/10"
          style={{ color: "var(--loombus-text-strong, #18181b)" }}
        >
          Open Transparency Reporting
        </Link>
        <Link
          href="/admin/professional-booking/payments"
          className="inline-flex items-center justify-center rounded-full border border-[#CBAB5B]/50 px-5 py-3 text-sm font-semibold transition hover:border-[#CBAB5B] hover:bg-[#CBAB5B]/10"
          style={{ color: "var(--loombus-text-strong, #18181b)" }}
        >
          Open Booking Payments
        </Link>
        <Link
          href="/admin/enforcement"
          className="inline-flex items-center justify-center rounded-full bg-[#CBAB5B] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-105"
        >
          Open Enforcement &amp; Appeals
        </Link>
      </nav>
      <AdminOperationsClient />
    </>
  );
}
