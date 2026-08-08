import type { Metadata } from "next";
import Link from "next/link";
import LegalOperationsClient from "./legal-operations-client";

export const metadata: Metadata = {
  title: "Legal Operations | Loombus Admin",
  description: "Restricted legal-request, preservation, and disclosure-preparation operations workspace.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LegalOperationsPage() {
  return (
    <div data-loombus-legal-operations>
      <div className="mx-auto max-w-[1500px] px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <div className="font-semibold text-zinc-950 dark:text-zinc-100">
              Disclosure preparation controls
            </div>
            <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Draft metadata and least-data manifest preparation only. Export generation, approval,
              member notice sending, and external transmission remain disabled.
            </div>
          </div>
          <Link
            className="rounded-xl border border-zinc-300 px-3 py-2 font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
            href="/admin/legal-operations/disclosure-preparation"
          >
            Open preparation workspace
          </Link>
        </div>
      </div>
      <LegalOperationsClient />
    </div>
  );
}
