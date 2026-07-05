"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BriefcaseBusiness } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

type ListingSummary = {
  id: string;
  title: string;
  listingType: string;
  isFeatured: boolean;
  status: string;
  createdAt: string | null;
};

type RequestSummary = {
  id: string;
  status: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function normalizeListing(row: Row, index: number): ListingSummary {
  return {
    id: asString(row.id) || `listing-${index}`,
    title: asString(row.title) || "Untitled listing",
    listingType: asString(row.listing_type) || "service",
    isFeatured: asBoolean(row.is_featured),
    status: asString(row.status) || "active",
    createdAt: asString(row.created_at) || null,
  };
}

function normalizeRequest(row: Row, index: number): RequestSummary {
  return {
    id: asString(row.id) || `service-request-${index}`,
    status: asString(row.status) || "new",
  };
}

function formatRelativeTime(value: string | null) {
  if (!value) return "recently";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "recently";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function RoomServicesSummary({ roomId }: { roomId: string }) {
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [railHost, setRailHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const resourceSummary = document.querySelector('[data-room-resource-summary="true"]');
    const requestSummary = document.querySelector('[data-room-request-summary="true"]');
    const billingSection = document.getElementById("billing");
    const anchor = resourceSummary ?? requestSummary ?? billingSection;
    if (!anchor) return;

    const host = document.createElement("div");
    host.setAttribute("data-room-services-summary", "true");
    anchor.insertAdjacentElement("afterend", host);
    setRailHost(host);

    return () => {
      host.remove();
      setRailHost(null);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      if (!roomId) return;
      setLoading(true);

      const [{ data: listingData }, { data: requestData }] = await Promise.all([
        supabase
          .from("room_service_listings")
          .select("id,title,listing_type,is_featured,status,created_at")
          .eq("room_id", roomId)
          .order("is_featured", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("room_service_requests")
          .select("id,status")
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .limit(25),
      ]);

      if (!cancelled) {
        setListings(((listingData ?? []) as Row[]).map(normalizeListing));
        setRequests(((requestData ?? []) as Row[]).map(normalizeRequest));
        setLoading(false);
      }
    }

    loadSummary();

    const listingChannel = supabase
      .channel(`room-services-listings-summary-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_service_listings", filter: `room_id=eq.${roomId}` }, loadSummary)
      .subscribe();

    const requestChannel = supabase
      .channel(`room-services-requests-summary-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_service_requests", filter: `room_id=eq.${roomId}` }, loadSummary)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(listingChannel);
      supabase.removeChannel(requestChannel);
    };
  }, [roomId]);

  const featuredCount = listings.filter((listing) => listing.isFeatured).length;
  const activeRequestCount = requests.filter((request) => request.status === "new" || request.status === "accepted" || request.status === "in_progress").length;
  const latestListing = listings[0];

  const card = (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <BriefcaseBusiness className="size-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Services / Store</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">
              {loading ? "Checking marketplace" : `${listings.length} listing${listings.length === 1 ? "" : "s"}`}
            </h2>
          </div>
        </div>
        {activeRequestCount > 0 && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">{activeRequestCount} active</span>}
      </div>

      {latestListing ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <div className="flex flex-wrap gap-2">
            {latestListing.isFeatured && <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100">Featured</span>}
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200">{latestListing.listingType.replace(/_/g, " ")}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-black text-slate-900">{latestListing.title}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">Added {formatRelativeTime(latestListing.createdAt)}</p>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600 ring-1 ring-slate-200">No services or offers yet.</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs font-black text-slate-600">
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><span className="block text-lg text-slate-950">{featuredCount}</span> featured</div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><span className="block text-lg text-slate-950">{activeRequestCount}</span> requests</div>
      </div>

      <Link href={`/rooms/${roomId}/services`} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
        Open Services / Store
      </Link>
    </section>
  );

  if (!railHost) return null;
  return createPortal(card, railHost);
}
