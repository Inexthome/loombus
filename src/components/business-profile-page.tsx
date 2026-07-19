"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarCheck,
  Globe2,
  Loader2,
  Mail,
  Phone,
  Search,
  ShieldCheck,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { BusinessProfile } from "@/lib/business-directory";
import { supabase } from "@/lib/supabase/client";
import { BusinessProfileOverview } from "@/components/business-profile-overview";
import { BusinessProfileServices } from "@/components/business-profile-services";
import {
  BusinessProfileAccountability,
  type BusinessProfilePanel,
} from "@/components/business-profile-accountability";

function safeExternalHref(value: string) {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
}

export default function BusinessProfilePage() {
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [panel, setPanel] = useState<BusinessProfilePanel>(null);
  const [working, setWorking] = useState(false);
  const [claimEmail, setClaimEmail] = useState("");
  const [claimEvidence, setClaimEvidence] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");

  const pathname = usePathname();
  const slug = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] ?? "");
  }, [pathname]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/businesses?slug=${encodeURIComponent(slug)}`,
          { cache: "no-store" },
        );
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !payload.business) {
          setMessage(payload.error ?? "Business not found.");
          return;
        }
        setBusiness(payload.business as BusinessProfile);
      } catch {
        if (!cancelled) setMessage("Unable to load this business profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function authenticatedAction(payload: Record<string, unknown>) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      return null;
    }

    const response = await fetch("/api/businesses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error ?? "Unable to complete the request.");
    }
    return result;
  }

  async function submitClaim(event: FormEvent) {
    event.preventDefault();
    if (!business || working) return;
    setWorking(true);
    setMessage("");
    try {
      const result = await authenticatedAction({
        action: "claim",
        businessId: business.id,
        contactEmail: claimEmail,
        evidence: claimEvidence,
      });
      if (!result) return;
      setPanel(null);
      setClaimEmail("");
      setClaimEvidence("");
      setMessage("Your ownership claim was submitted for administrator review.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to submit the claim.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (!business || working) return;
    setWorking(true);
    setMessage("");
    try {
      const result = await authenticatedAction({
        action: "report",
        businessId: business.id,
        reason: reportReason,
        details: reportDetails,
      });
      if (!result) return;
      setPanel(null);
      setReportReason("");
      setReportDetails("");
      setMessage("The listing report was submitted for review.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to submit the report.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-10 text-[color:var(--loombus-text)] sm:px-6">
        <div className="mx-auto grid min-h-64 max-w-[88rem] place-items-center rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)]">
            <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={18} /> Loading business profile
          </span>
        </div>
      </main>
    );
  }

  if (!business) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-12 text-[color:var(--loombus-text)] sm:px-6">
        <section className="mx-auto max-w-2xl rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center shadow-xl shadow-black/10">
          <Building2 className="mx-auto text-[color:var(--loombus-gold)]" size={34} />
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">Business profile unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            {message || "This listing may be under review or no longer public."}
          </p>
          <Link
            href="/businesses"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-5 py-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]"
          >
            <ArrowLeft size={16} /> Back to Businesses
          </Link>
        </section>
      </main>
    );
  }

  const website = safeExternalHref(business.websiteUrl);
  const booking = safeExternalHref(business.bookingUrl);

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-16 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[88rem]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/businesses"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-gold)]"
          >
            <ArrowLeft size={16} /> Back to Businesses
          </Link>
          <Link
            href="/local"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]"
          >
            Explore Local <ArrowUpRight size={14} />
          </Link>
        </div>

        <BusinessProfileOverview business={business} />

        {message ? (
          <p className="mt-5 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm shadow-sm" role="status">
            {message}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0">
            <BusinessProfileServices business={business} />
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Contact and destinations</p>
              <div className="mt-4 space-y-2">
                {business.phone ? (
                  <a
                    href={`tel:${business.phone}`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2"><Phone size={16} className="shrink-0 text-[color:var(--loombus-gold)]" /><span className="truncate">{business.phone}</span></span>
                    <ArrowUpRight size={14} className="shrink-0" />
                  </a>
                ) : null}
                {business.contactEmail ? (
                  <a
                    href={`mailto:${business.contactEmail}`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2"><Mail size={16} className="shrink-0 text-[color:var(--loombus-gold)]" /><span className="truncate">Email business</span></span>
                    <ArrowUpRight size={14} className="shrink-0" />
                  </a>
                ) : null}
                {website ? (
                  <a
                    href={website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]"
                  >
                    <span className="inline-flex items-center gap-2"><Globe2 size={16} className="text-[color:var(--loombus-gold)]" /> Website</span>
                    <ArrowUpRight size={14} />
                  </a>
                ) : null}
                {booking ? (
                  <a
                    href={booking}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-cream)] px-4 py-3 text-sm font-semibold text-[color:var(--loombus-cream-contrast)] transition hover:opacity-90 dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                  >
                    <span className="inline-flex items-center gap-2"><CalendarCheck size={16} /> Request or book</span>
                    <ArrowUpRight size={14} />
                  </a>
                ) : null}
                <Link
                  href={`/search?q=${encodeURIComponent(business.name)}`}
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  <span className="inline-flex items-center gap-2"><Search size={16} className="text-[color:var(--loombus-gold)]" /> Search Loombus</span>
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            </section>

            <BusinessProfileAccountability
              business={business}
              panel={panel}
              working={working}
              claimEmail={claimEmail}
              claimEvidence={claimEvidence}
              reportReason={reportReason}
              reportDetails={reportDetails}
              onPanelChange={setPanel}
              onClaimEmailChange={setClaimEmail}
              onClaimEvidenceChange={setClaimEvidence}
              onReportReasonChange={setReportReason}
              onReportDetailsChange={setReportDetails}
              onSubmitClaim={submitClaim}
              onSubmitReport={submitReport}
            />

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Loombus provides attribution and review tools but does not guarantee licensing, pricing, availability, service quality, or transaction outcomes.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
