"use client";

import Link from "next/link";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
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
          { cache: "no-store" }
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
        error instanceof Error ? error.message : "Unable to submit the claim."
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
        error instanceof Error ? error.message : "Unable to submit the report."
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <main className="loombus-shell-with-right-rail flex min-h-screen items-center justify-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
        <Loader2 className="animate-spin" size={28} />
      </main>
    );
  }

  if (!business) {
    return (
      <main className="loombus-shell-with-right-rail min-h-screen bg-[var(--loombus-page-bg)] px-4 py-12 text-[var(--loombus-text)]">
        <section className="mx-auto max-w-2xl rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
          <Building2 className="mx-auto" size={28} />
          <h1 className="mt-3 text-2xl font-semibold">
            Business profile unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
            {message ||
              "This listing may be under review or no longer public."}
          </p>
          <Link
            href="/businesses"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold"
          >
            <ArrowLeft size={16} /> Back to directory
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="loombus-shell-with-right-rail min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/businesses"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)]"
        >
          <ArrowLeft size={16} /> Local Business and Services
        </Link>

        <BusinessProfileOverview business={business} />
        <BusinessProfileServices business={business} />

        {message ? (
          <p className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">
            {message}
          </p>
        ) : null}

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
      </div>
    </main>
  );
}
