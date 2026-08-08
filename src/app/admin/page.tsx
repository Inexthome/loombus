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
          href="/admin/legal-operations"
          className="inline-flex items-center justify-center rounded-full border border-[#CBAB5B]/50 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:border-[#CBAB5B] hover:bg-[#CBAB5B]/10 dark:text-zinc-100"
        >
          Open Legal Operations
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
