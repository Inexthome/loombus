"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const STATUS_COPY: Record<string, { title: string; message: string }> = {
  suspended: {
    title: "Your account is suspended.",
    message:
      "Access to authenticated Loombus features is temporarily unavailable. Contact support if you believe this is an error.",
  },
  banned: {
    title: "Your account is restricted.",
    message:
      "This account cannot access authenticated Loombus features. Contact support for information about an appeal.",
  },
  deactivated: {
    title: "Your account is deactivated.",
    message:
      "This account was deactivated and cannot access authenticated Loombus features until it is restored.",
  },
  deletion_requested: {
    title: "Your deletion request is pending.",
    message:
      "Authenticated account actions are restricted while your deletion request is being reviewed.",
  },
};

export default function AccountAccessPage() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "restricted";
  const copy =
    STATUS_COPY[status] ??
    ({
      title: "Account access is unavailable.",
      message:
        "This account cannot currently access authenticated Loombus features. Contact support for assistance.",
    } satisfies { title: string; message: string });

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-12 text-white sm:px-6">
      <section className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-8">
        <p className="mb-3 text-xs uppercase tracking-[0.3em] text-zinc-500">
          Loombus account access
        </p>

        <h1 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {copy.title}
        </h1>

        <p className="mb-7 leading-relaxed text-zinc-400">{copy.message}</p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/contact"
            className="inline-flex justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Contact support
          </Link>

          <Link
            href="/"
            className="inline-flex justify-center rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Return to Loombus
          </Link>
        </div>
      </section>
    </main>
  );
}
