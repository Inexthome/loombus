"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Building2, CalendarCheck, Globe2, Loader2, Mail, Phone, Search, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { BusinessProfile } from "@/lib/business-directory";
import { supabase } from "@/lib/supabase/client";
import { BusinessProfileOverview } from "@/components/business-profile-overview";
import { BusinessProfileServices } from "@/components/business-profile-services";
import { BusinessProfileAccountability, type BusinessProfilePanel } from "@/components/business-profile-accountability";

function safeExternalHref(value: string) {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
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
  const slug = useMemo(() => decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) ?? ""), [pathname]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/businesses?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
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
    return () => { cancelled = true; };
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
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Unable to complete the request.");
    return result;
  }

  async function submitClaim(event: FormEvent) {
    event.preventDefault();
    if (!business || working) return;
    setWorking(true);
    setMessage("");
    try {
      const result = await authenticatedAction({ action: "claim", businessId: business.id, contactEmail: claimEmail, evidence: claimEvidence });
      if (!result) return;
      setPanel(null);
      setClaimEmail("");
      setClaimEvidence("");
      setMessage("Your ownership claim was submitted for administrator review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit the claim.");
    } finally { setWorking(false); }
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (!business || working) return;
    setWorking(true);
    setMessage("");
    try {
      const result = await authenticatedAction({ action: "report", businessId: business.id, reason: reportReason, details: reportDetails });
      if (!result) return;
      setPanel(null);
      setReportReason("");
      setReportDetails("");
      setMessage("The listing report was submitted for review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit the report.");
    } finally { setWorking(false); }
  }

  if (loading) return <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-10 text-[color:var(--loombus-text)]"><div className="mx-auto flex min-h-64 max-w-[82rem] items-center justify-center border-b border-[color:var(--loombus-border)]"><Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={22} /></div></main>;

  if (!business) return <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-12 text-[color:var(--loombus-text)]"><section className="mx-auto max-w-2xl border-y border-[color:var(--loombus-border)] py-10"><Building2 className="text-[color:var(--loombus-gold)]" size={28} /><h1 className="mt-4 text-2xl font-semibold">Business profile unavailable</h1><p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{message || "This listing may be under review or no longer public."}</p><Link href="/businesses" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-gold)] hover:underline"><ArrowLeft size={15} /> Back to Businesses</Link></section></main>;

  const website = safeExternalHref(business.websiteUrl);
  const booking = safeExternalHref(business.bookingUrl);

  return (
    <main data-business-editorial="profile" className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-14 pt-7 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[82rem]">
        <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--loombus-border)] pb-4 text-sm font-semibold" aria-label="Business profile navigation">
          <Link href="/businesses" className="inline-flex items-center gap-2 text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-gold)]"><ArrowLeft size={15} /> Businesses</Link>
          <Link href="/local" className="inline-flex items-center gap-2 hover:text-[color:var(--loombus-gold)]">Explore Local <ArrowUpRight size={14} /></Link>
        </nav>

        <BusinessProfileOverview business={business} />
        {message ? <p className="border-b border-[color:var(--loombus-border)] py-4 text-sm" role="status">{message}</p> : null}

        <BusinessProfileServices business={business} />

        <section className="grid border-b border-[color:var(--loombus-border)] lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.55fr)]">
          <div className="py-7 lg:pr-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-gold)]">Contact and destinations</p>
            <div className="mt-4 divide-y divide-[color:var(--loombus-border-muted)]">
              {business.phone ? <a href={`tel:${business.phone}`} className="flex items-center justify-between gap-3 py-3 text-sm font-semibold hover:text-[color:var(--loombus-gold)]"><span className="inline-flex items-center gap-2"><Phone size={15} />{business.phone}</span><ArrowUpRight size={14} /></a> : null}
              {business.contactEmail ? <a href={`mailto:${business.contactEmail}`} className="flex items-center justify-between gap-3 py-3 text-sm font-semibold hover:text-[color:var(--loombus-gold)]"><span className="inline-flex items-center gap-2"><Mail size={15} />Email business</span><ArrowUpRight size={14} /></a> : null}
              {website ? <a href={website} target="_blank" rel="noreferrer" className="flex items-center justify-between py-3 text-sm font-semibold hover:text-[color:var(--loombus-gold)]"><span className="inline-flex items-center gap-2"><Globe2 size={15} />Website</span><ArrowUpRight size={14} /></a> : null}
              {booking ? <a href={booking} target="_blank" rel="noreferrer" className="flex items-center justify-between py-3 text-sm font-semibold text-[color:var(--loombus-gold)] hover:underline"><span className="inline-flex items-center gap-2"><CalendarCheck size={15} />Request or book</span><ArrowUpRight size={14} /></a> : null}
              <Link href={`/search?q=${encodeURIComponent(business.name)}`} className="flex items-center justify-between py-3 text-sm font-semibold hover:text-[color:var(--loombus-gold)]"><span className="inline-flex items-center gap-2"><Search size={15} />Search Loombus</span><ArrowUpRight size={14} /></Link>
            </div>
          </div>
          <div className="border-t border-[color:var(--loombus-border)] py-7 lg:border-l lg:border-t-0 lg:pl-8">
            <BusinessProfileAccountability business={business} panel={panel} working={working} claimEmail={claimEmail} claimEvidence={claimEvidence} reportReason={reportReason} reportDetails={reportDetails} onPanelChange={setPanel} onClaimEmailChange={setClaimEmail} onClaimEvidenceChange={setClaimEvidence} onReportReasonChange={setReportReason} onReportDetailsChange={setReportDetails} onSubmitClaim={submitClaim} onSubmitReport={submitReport} />
          </div>
        </section>

        <footer className="flex gap-3 py-6 text-sm leading-6 text-[color:var(--loombus-text-muted)]"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" /><p>Loombus provides attribution and review tools but does not guarantee licensing, pricing, availability, service quality, or transaction outcomes.</p></footer>
      </div>
    </main>
  );
}
