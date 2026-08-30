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
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-10 text-[color:var(--loombus-text)] sm:px-6 sm:py-14"
    >
      <div className="mx-auto w-full max-w-5xl">
        <header className="border-b border-[color:var(--loombus-border)] pb-8 sm:pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">
            Loombus account access
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            {copy.title}
          </h1>
        </header>

        <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:gap-14 lg:py-12">
          <section aria-labelledby="account-access-status-heading">
            <h2 id="account-access-status-heading" className="text-lg font-semibold">
              Current access status
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--loombus-muted)]">
              {copy.message}
            </p>
          </section>

          <aside className="border-t border-[color:var(--loombus-border)] pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <p className="text-sm font-semibold">Available next steps</p>
            <div className="mt-5 flex flex-col border-t border-[color:var(--loombus-border)]">
              {showDecisionHistory ? (
                <Link
                  href="/account/enforcement"
                  className="account-access-primary inline-flex min-h-11 items-center border-b border-[color:var(--loombus-border)] py-3 text-sm font-semibold text-[color:var(--loombus-gold)] transition-colors hover:text-[color:var(--loombus-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--loombus-page-bg)]"
                >
                  View decisions and appeals
                </Link>
              ) : null}

              <Link
                href="/support"
                className="inline-flex min-h-11 items-center border-b border-[color:var(--loombus-border)] py-3 text-sm font-medium text-[color:var(--loombus-text)] transition-colors hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--loombus-page-bg)]"
              >
                Contact Support
              </Link>

              <Link
                href="/"
                className="inline-flex min-h-11 items-center border-b border-[color:var(--loombus-border)] py-3 text-sm font-medium text-[color:var(--loombus-text)] transition-colors hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--loombus-page-bg)]"
              >
                Return to Loombus
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
