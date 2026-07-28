"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const STATUS_COPY: Record<string, { title: string; message: string }> = {
  suspended: {
    title: "Your account is suspended.",
    message:
      "Access to authenticated Loombus features is temporarily unavailable. You can review the recorded decision and submit an appeal when that decision is eligible.",
  },
  banned: {
    title: "Your account is restricted.",
    message:
      "This account cannot access ordinary authenticated Loombus features. The decision-history page remains available for eligible appeal and review information.",
  },
  deactivated: {
    title: "Your account is deactivated.",
    message:
      "This account cannot access ordinary authenticated Loombus features until it is restored. Review the account record for any related enforcement decision.",
  },
  deletion_requested: {
    title: "Your deletion request is pending.",
    message:
      "Authenticated account actions are restricted while your deletion request is being reviewed.",
  },
  verification_unavailable: {
    title: "We could not verify account access.",
    message:
      "Loombus could not confirm the current account status. Protected pages remain closed until verification succeeds. Return later or contact Support if the problem continues.",
  },
  profile_unavailable: {
    title: "Your account profile could not be verified.",
    message:
      "Protected Loombus features require an available account profile. Contact Support so the account record can be reviewed safely.",
  },
  account_access_unverified: {
    title: "Your account status needs review.",
    message:
      "Loombus could not recognize the current account-access state. Protected pages and account mutations remain closed until the status is reviewed.",
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
        "This account cannot currently access authenticated Loombus features. Review any recorded decision or contact Support for assistance.",
    } satisfies { title: string; message: string });
  const showDecisionHistory = !["deletion_requested", "profile_unavailable"].includes(status);

  return (
    <main
      data-loombus-auth-shell
      data-loombus-account-access
      className="flex min-h-screen items-center justify-center bg-black px-4 py-12 text-white sm:px-6"
    >
      <section className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-8">
        <p className="mb-3 text-xs uppercase tracking-[0.3em] text-zinc-500">
          Loombus account access
        </p>

        <h1 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {copy.title}
        </h1>

        <p className="mb-7 leading-relaxed text-zinc-400">{copy.message}</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {showDecisionHistory ? (
            <Link
              href="/account/enforcement"
              className="account-access-primary inline-flex justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition"
            >
              View decisions and appeals
            </Link>
          ) : null}

          <Link
            href="/support"
            className="inline-flex justify-center rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Contact Support
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
