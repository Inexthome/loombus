"use client";

import Link from "next/link";
import { HandHeart, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { requestLocationLabel, requestTypeLabel, type PublicServiceRequest } from "@/lib/service-requests";

export default function PublicRequestsSection({ requesterUsername, businessSlug, heading = "Open Requests" }: { requesterUsername?: string; businessSlug?: string; heading?: string }) {
  const [requests, setRequests] = useState<PublicServiceRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ pageSize: "6" });
    if (requesterUsername) params.set("requesterUsername", requesterUsername);
    if (businessSlug) params.set("businessSlug", businessSlug);
    void fetch(`/api/requests?${params.toString()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => { if (active) setRequests(Array.isArray(payload.requests) ? payload.requests : []); })
      .catch(() => null)
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [businessSlug, requesterUsername]);
  if (!loaded || requests.length === 0) return null;
  return (
    <section className="bg-[var(--loombus-page-bg)] px-4 pb-10 text-[var(--loombus-text)] sm:px-6"><div className="mx-auto max-w-6xl rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Loombus Requests</p><h2 className="mt-1 text-2xl font-semibold">{heading}</h2></div><Link href="/requests" className="text-sm font-semibold">Browse all</Link></div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{requests.map((item) => <Link key={item.id} href={`/requests/${item.slug}`} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"><div className="flex items-center gap-2 text-xs font-semibold text-[var(--loombus-text-subtle)]"><HandHeart size={14} /> {requestTypeLabel(item.requestType)}</div><h3 className="mt-2 text-lg font-semibold leading-snug">{item.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--loombus-text-muted)]">{item.description}</p><span className="mt-4 flex items-start gap-2 text-xs text-[var(--loombus-text-muted)]"><MapPin size={14} /> {requestLocationLabel(item)}</span></Link>)}</div></div></section>
  );
}
