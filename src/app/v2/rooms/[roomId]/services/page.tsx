"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, BriefcaseBusiness, CalendarClock, CheckCircle2, Plus, Send, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../../v2-shell-components";

type Row = Record<string, unknown>;

type Room = {
  id: string;
  name: string;
  ownerId: string;
  createdBy: string;
  isPrivate: boolean;
};

type Member = {
  userId: string;
  role: string;
};

type ServiceListing = {
  id: string;
  title: string;
  description: string;
  listingType: string;
  priceLabel: string;
  availabilityLabel: string;
  providerName: string;
  contactLabel: string;
  status: string;
  isFeatured: boolean;
  createdAt: string | null;
};

type ServiceRequest = {
  id: string;
  listingId: string;
  title: string;
  details: string;
  requestedFor: string;
  requesterContact: string;
  status: string;
  createdBy: string;
  createdAt: string | null;
};

const LISTING_TYPES = ["service", "product", "offer", "appointment", "internal_request"] as const;
const LISTING_STATUSES = ["draft", "active", "paused", "archived"] as const;
const REQUEST_STATUSES = ["new", "accepted", "in_progress", "completed", "cancelled"] as const;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function normalizeRoom(row: Row): Room {
  const visibility = asString(row.visibility).toLowerCase();
  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || "Untitled room",
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
    isPrivate: asBoolean(row.is_private) || asBoolean(row.private) || visibility === "private",
  };
}

function normalizeMember(row: Row): Member {
  return {
    userId: asString(row.user_id),
    role: asString(row.role) || "member",
  };
}

function normalizeListing(row: Row, index: number): ServiceListing {
  return {
    id: asString(row.id) || `listing-${index}`,
    title: asString(row.title) || "Untitled listing",
    description: asString(row.description),
    listingType: asString(row.listing_type) || "service",
    priceLabel: asString(row.price_label),
    availabilityLabel: asString(row.availability_label),
    providerName: asString(row.provider_name),
    contactLabel: asString(row.contact_label),
    status: asString(row.status) || "active",
    isFeatured: asBoolean(row.is_featured),
    createdAt: asString(row.created_at) || null,
  };
}

function normalizeServiceRequest(row: Row, index: number): ServiceRequest {
  return {
    id: asString(row.id) || `service-request-${index}`,
    listingId: asString(row.listing_id),
    title: asString(row.title) || "Untitled request",
    details: asString(row.details),
    requestedFor: asString(row.requested_for),
    requesterContact: asString(row.requester_contact),
    status: asString(row.status) || "new",
    createdBy: asString(row.created_by),
    createdAt: asString(row.created_at) || null,
  };
}

function formatRelativeTime(value: string | null) {
  if (!value) return "Recently";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function getRequestStatusClass(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "accepted" || status === "in_progress") return "bg-amber-50 text-amber-700 ring-amber-100";
  if (status === "cancelled") return "bg-slate-100 text-slate-500 ring-slate-200";
  return "bg-blue-50 text-blue-700 ring-blue-100";
}

export default function V2RoomServicesStorePage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => {
    if (Array.isArray(rawRoomId)) return rawRoomId[0] ?? "";
    return rawRoomId ?? "";
  }, [rawRoomId]);

  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [listings, setListings] = useState<ServiceListing[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [listingTitle, setListingTitle] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [listingType, setListingType] = useState<(typeof LISTING_TYPES)[number]>("service");
  const [priceLabel, setPriceLabel] = useState("");
  const [availabilityLabel, setAvailabilityLabel] = useState("");
  const [providerName, setProviderName] = useState("");
  const [contactLabel, setContactLabel] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);

  const [selectedListingId, setSelectedListingId] = useState("");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDetails, setRequestDetails] = useState("");
  const [requestedFor, setRequestedFor] = useState("");
  const [requesterContact, setRequesterContact] = useState("");

  const currentMember = members.find((member) => member.userId === userId);
  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const isAdmin = currentMember?.role === "owner" || currentMember?.role === "admin";
  const canAccess = Boolean(room && userId && (isOwner || currentMember));
  const canManage = Boolean(room && userId && (isOwner || isAdmin));
  const visibleListings = canManage ? listings : listings.filter((listing) => listing.status === "active");
  const featuredListings = visibleListings.filter((listing) => listing.isFeatured);
  const activeRequests = serviceRequests.filter((request) => request.status === "new" || request.status === "accepted" || request.status === "in_progress");

  async function loadMarketplace(targetRoomId = roomId) {
    if (!targetRoomId) return;

    const [{ data: listingData }, { data: requestData }] = await Promise.all([
      supabase
        .from("room_service_listings")
        .select("*")
        .eq("room_id", targetRoomId)
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("room_service_requests")
        .select("*")
        .eq("room_id", targetRoomId)
        .order("created_at", { ascending: false }),
    ]);

    setListings(((listingData ?? []) as Row[]).map(normalizeListing));
    setServiceRequests(((requestData ?? []) as Row[]).map(normalizeServiceRequest));
  }

  async function loadRoom() {
    if (!roomId) return;
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const nextUserId = data.session?.user.id ?? null;
      setUserId(nextUserId);

      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (!nextUserId || !accessToken || !nextPayload.authenticated || !nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") {
        setRoom(null);
        setMembers([]);
        setListings([]);
        setServiceRequests([]);
        return;
      }

      const { data: roomData, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      if (roomError || !roomData) {
        setRoom(null);
        setMembers([]);
        setListings([]);
        setServiceRequests([]);
        setMessage("Services and store are only visible to approved room members.");
        return;
      }

      const nextRoom = normalizeRoom(roomData as Row);
      setRoom(nextRoom);

      const { data: memberData } = await supabase.from("room_members").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
      const nextMembers = ((memberData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId);
      setMembers(nextMembers);

      const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
      const nextIsMember = nextMembers.some((member) => member.userId === nextUserId);
      if (nextRoom.isPrivate && !nextIsOwner && !nextIsMember) {
        setListings([]);
        setServiceRequests([]);
        setMessage("Services and store are private to approved room members.");
        return;
      }

      await loadMarketplace(roomId);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to load room services right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoom();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadRoom();
    });
    return () => data.subscription.unsubscribe();
  }, [roomId]);

  async function handleCreateListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !canManage || !listingTitle.trim()) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_service_listings").insert({
        room_id: room.id,
        title: listingTitle.trim(),
        description: listingDescription.trim(),
        listing_type: listingType,
        price_label: priceLabel.trim(),
        availability_label: availabilityLabel.trim(),
        provider_name: providerName.trim(),
        contact_label: contactLabel.trim(),
        status: "active",
        is_featured: isFeatured,
        created_by: userId,
        updated_by: userId,
      });

      if (error) throw error;
      setListingTitle("");
      setListingDescription("");
      setListingType("service");
      setPriceLabel("");
      setAvailabilityLabel("");
      setProviderName("");
      setContactLabel("");
      setIsFeatured(false);
      setMessage("Listing published.");
      await loadMarketplace();
    } catch {
      setMessage("Loombus could not publish this listing yet. Confirm the services/store migration and RLS policies are active.");
    } finally {
      setSaving(false);
    }
  }

  async function handleListingUpdate(listing: ServiceListing, updates: Partial<{ status: string; is_featured: boolean }>) {
    if (!canManage || !userId) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("room_service_listings")
        .update({ ...updates, updated_by: userId, updated_at: new Date().toISOString() })
        .eq("id", listing.id);

      if (error) throw error;
      setMessage("Listing updated.");
      await loadMarketplace();
    } catch {
      setMessage("Loombus could not update this listing yet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateServiceRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !selectedListingId || !requestTitle.trim()) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_service_requests").insert({
        room_id: room.id,
        listing_id: selectedListingId,
        title: requestTitle.trim(),
        details: requestDetails.trim(),
        requested_for: requestedFor.trim(),
        requester_contact: requesterContact.trim(),
        status: "new",
        created_by: userId,
        updated_by: userId,
      });

      if (error) throw error;
      setRequestTitle("");
      setRequestDetails("");
      setRequestedFor("");
      setRequesterContact("");
      setMessage("Service request submitted.");
      await loadMarketplace();
    } catch {
      setMessage("Loombus could not submit this service request yet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleServiceRequestStatusUpdate(request: ServiceRequest, status: string) {
    if (!canManage || !userId) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("room_service_requests")
        .update({ status, updated_by: userId, updated_at: new Date().toISOString() })
        .eq("id", request.id);

      if (error) throw error;
      setMessage("Service request updated.");
      await loadMarketplace();
    } catch {
      setMessage("Loombus could not update this service request yet.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <V2ShellGateCard title="Opening services" message="Loombus is loading this room services and store center." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can open this room." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag." payload={payload} />;

  const selectedListing = visibleListings.find((listing) => listing.id === selectedListingId) ?? visibleListings[0];

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
          <ArrowLeft className="size-4" /> Back to room
        </Link>
        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Room Services / Store</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{room?.name ?? "Room services"}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50/90 sm:text-base">Create service listings, store offers, appointment intents, and tracked member requests inside this private room.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{visibleListings.length} listings</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{activeRequests.length} active requests</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{featuredListings.length} featured</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{canManage ? "Owner/admin tools" : "Member marketplace"}</span>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              {canManage && (
                <form onSubmit={handleCreateListing} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-3">
                    <Plus className="size-5 text-amber-700" />
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Create listing</h2>
                      <p className="mt-1 text-sm text-slate-600">Publish services, products, offers, appointments, or internal room requests.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_190px]">
                    <input value={listingTitle} onChange={(event) => setListingTitle(event.target.value)} placeholder="Listing title" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                    <select value={listingType} onChange={(event) => setListingType(event.target.value as (typeof LISTING_TYPES)[number])} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100">
                      {LISTING_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <textarea value={listingDescription} onChange={(event) => setListingDescription(event.target.value)} placeholder="Description" rows={4} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input value={priceLabel} onChange={(event) => setPriceLabel(event.target.value)} placeholder="Price or quote label" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                    <input value={availabilityLabel} onChange={(event) => setAvailabilityLabel(event.target.value)} placeholder="Availability" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                    <input value={providerName} onChange={(event) => setProviderName(event.target.value)} placeholder="Provider name" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                    <input value={contactLabel} onChange={(event) => setContactLabel(event.target.value)} placeholder="Contact or next step" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm font-black text-slate-700"><input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} className="size-4" /> Feature this listing</label>
                    <button type="submit" disabled={saving || !listingTitle.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Sparkles className="size-4" /> Publish listing</button>
                  </div>
                </form>
              )}

              <section className="space-y-3">
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Listings</h2>
                {visibleListings.map((listing) => (
                  <article key={listing.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          {listing.isFeatured && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100">Featured</span>}
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200">{listing.listingType.replace(/_/g, " ")}</span>
                          {canManage && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200">{listing.status}</span>}
                        </div>
                        <h3 className="mt-3 text-lg font-black text-slate-950">{listing.title}</h3>
                        {listing.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{listing.description}</p>}
                        <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600 md:grid-cols-2">
                          {listing.priceLabel && <p><span className="font-black text-slate-900">Price:</span> {listing.priceLabel}</p>}
                          {listing.availabilityLabel && <p><span className="font-black text-slate-900">Availability:</span> {listing.availabilityLabel}</p>}
                          {listing.providerName && <p><span className="font-black text-slate-900">Provider:</span> {listing.providerName}</p>}
                          {listing.contactLabel && <p><span className="font-black text-slate-900">Next step:</span> {listing.contactLabel}</p>}
                        </div>
                        <p className="mt-3 text-xs font-semibold text-slate-400">Added {formatRelativeTime(listing.createdAt)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => { setSelectedListingId(listing.id); setRequestTitle(listing.title); }} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"><Send className="size-4" /> Request this</button>
                      {canManage && <button type="button" onClick={() => handleListingUpdate(listing, { is_featured: !listing.isFeatured })} disabled={saving} className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50">{listing.isFeatured ? "Unfeature" : "Feature"}</button>}
                      {canManage && LISTING_STATUSES.map((status) => <button key={status} type="button" onClick={() => handleListingUpdate(listing, { status })} disabled={saving || listing.status === status} className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-40">{status}</button>)}
                    </div>
                  </article>
                ))}
                {visibleListings.length === 0 && <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center"><BriefcaseBusiness className="mx-auto size-9 text-amber-700" /><h2 className="mt-3 text-lg font-black text-slate-950">No services or offers yet</h2><p className="mt-2 text-sm text-slate-600">Create the first room service, product, offer, appointment, or internal request listing.</p></div>}
              </section>
            </div>

            <aside className="space-y-4">
              <form onSubmit={handleCreateServiceRequest} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Request service</h2><CalendarClock className="size-4 text-amber-700" /></div>
                <div className="mt-4 space-y-3">
                  <select value={selectedListingId || selectedListing?.id || ""} onChange={(event) => { setSelectedListingId(event.target.value); const listing = visibleListings.find((item) => item.id === event.target.value); if (listing) setRequestTitle(listing.title); }} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100">
                    <option value="">Choose listing</option>
                    {visibleListings.map((listing) => <option key={listing.id} value={listing.id}>{listing.title}</option>)}
                  </select>
                  <input value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} placeholder="Request title" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                  <input value={requestedFor} onChange={(event) => setRequestedFor(event.target.value)} placeholder="Requested date/time or need" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                  <input value={requesterContact} onChange={(event) => setRequesterContact(event.target.value)} placeholder="Contact or follow-up details" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                  <textarea value={requestDetails} onChange={(event) => setRequestDetails(event.target.value)} placeholder="Request details" rows={4} className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                  <button type="submit" disabled={saving || !requestTitle.trim() || !(selectedListingId || selectedListing?.id)} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Send className="size-4" /> Submit request</button>
                </div>
              </form>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Request pipeline</h2><CheckCircle2 className="size-4 text-amber-700" /></div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Active</dt><dd className="font-black text-slate-900">{activeRequests.length}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Total visible</dt><dd className="font-black text-slate-900">{serviceRequests.length}</dd></div>
                </dl>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Submitted requests</h2>
                <div className="mt-4 space-y-3">
                  {serviceRequests.map((request) => (
                    <article key={request.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ring-1 ${getRequestStatusClass(request.status)}`}>{request.status.replace(/_/g, " ")}</span>
                      <h3 className="mt-2 text-sm font-black text-slate-950">{request.title}</h3>
                      {request.requestedFor && <p className="mt-1 text-xs font-semibold text-slate-500">For: {request.requestedFor}</p>}
                      <p className="mt-1 text-xs font-semibold text-slate-400">Submitted {formatRelativeTime(request.createdAt)}</p>
                      {canManage && <div className="mt-3 flex flex-wrap gap-1">{REQUEST_STATUSES.map((status) => <button key={status} type="button" onClick={() => handleServiceRequestStatusUpdate(request, status)} disabled={saving || request.status === status} className="rounded-xl bg-white px-2 py-1 text-[10px] font-black text-slate-700 ring-1 ring-slate-200 disabled:opacity-40">{status.replace(/_/g, " ")}</button>)}</div>}
                    </article>
                  ))}
                  {serviceRequests.length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600 ring-1 ring-slate-200">No service requests yet.</p>}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
