import type { Metadata } from "next";
import Link from "next/link";
import ReportsV2Client from "./reports-v2-client";
import "./reports-v2.css";
import "../trust-safety-editorial.css";

export const metadata: Metadata = {
  title: "Reports | Loombus Admin",
  description:
    "Admin moderation queue for reviewing Loombus reports and recorded outcomes.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminReportsPage() {
  return (
    <>
      <div className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-black/95 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Admin safety operations
            </p>
            <p className="text-sm font-medium text-zinc-950 dark:text-white">
              Moderation reports
            </p>
          </div>
          <Link
            href="/admin/reports/trust-safety"
            className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/70"
          >
            Open restricted Trust and Safety cases
          </Link>
        </div>
      </div>
      <ReportsV2Client />
    </>
  );
}
