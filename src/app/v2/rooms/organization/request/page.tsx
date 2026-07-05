"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../../v2-shell-components";

const SUPPORT_EMAIL = "support@loombus.com";

function parseInitialValue(paramName: string, fallback = "") {
  if (typeof window === "undefined") return fallback;
  const value = new URLSearchParams(window.location.search).get(paramName);
  return value || fallback;
}

function buildSetupEmail(values: {
  organizationName: string;
  contactName: string;
  contactEmail: string;
  organizationType: string;
  estimatedMembers: string;
  requestedRooms: string;
  billingPreference: string;
  roomName: string;
  roomType: string;
  notes: string;
}) {
  const subject = `Organization Room Request: ${values.organizationName || "New Organization"}`;
  const body = [
    "Loombus Organization Room Request",
    "",
    `Organization name: ${values.organizationName}`,
    `Contact name: ${values.contactName}`,
    `Contact email: ${values.contactEmail}`,
    `Organization type: ${values.organizationType}`,
    `Estimated members: ${values.estimatedMembers}`,
    `Requested room count: ${values.requestedRooms}`,
    `Billing preference: ${values.billingPreference}`,
    `Requested room name: ${values.roomName}`,
    `Requested room type: ${values.roomType}`,
    "",
    "Notes:",
    values.notes || "No additional notes provided.",
  ].join("\n");

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function OrganizationRoomRequestPage() {
  const initializedFromUrl = useRef(false);
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [organizationType, setOrganizationType] = useState("Business / team");
  const [estimatedMembers, setEstimatedMembers] = useState("250-500");
  const [requestedRooms, setRequestedRooms] = useState("3-5");
  const [billingPreference, setBillingPreference] = useState("Monthly");
  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (initializedFromUrl.current) return;
    initializedFromUrl.current = true;
    setRoomName(parseInitialValue("roomName", "Organization Room"));
    setRoomType(parseInitialValue("roomType", parseInitialValue("template", "business")));
  }, []);

  async function loadShell() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      setContactEmail((current) => current || data.session?.user.email || "");
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 Rooms access. Current Loombus remains available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadShell();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationName.trim() || !contactName.trim() || !contactEmail.trim()) {
      setMessage("Add organization name, contact name, and contact email before preparing the setup request.");
      return;
    }

    setMessage("Opening your email app with the organization setup request.");
    window.location.href = buildSetupEmail({
      organizationName: organizationName.trim(),
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      organizationType,
      estimatedMembers,
      requestedRooms,
      billingPreference,
      roomName: roomName.trim() || "Organization Room",
      roomType: roomType.trim() || "business",
      notes: notes.trim(),
    });
  }

  if (loading) return <V2ShellGateCard title="Checking organization setup access" message="Loombus is preparing the organization room request flow." loading />;
  if (message && !payload) return <V2ShellGateCard title="Organization request check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can prepare an organization room request from your account." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-6xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-3">
          <Link href="/v2/rooms/new?plan=business" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
            <ArrowLeft className="size-4" />
            Back to room plans
          </Link>
          <Link href="/rooms" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
            Back to Rooms
          </Link>
        </div>

        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-800 p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Organization rooms</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Request a custom Loombus Room setup.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50/90 sm:text-base">Organization plans are quote-assisted because the right setup depends on rooms, members, billing terms, onboarding, and admin needs.</p>
          </div>

          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-black text-slate-700">
                  Organization name
                  <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100" />
                </label>
                <label className="space-y-2 text-sm font-black text-slate-700">
                  Contact name
                  <input value={contactName} onChange={(event) => setContactName(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100" />
                </label>
                <label className="space-y-2 text-sm font-black text-slate-700">
                  Contact email
                  <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} type="email" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100" />
                </label>
                <label className="space-y-2 text-sm font-black text-slate-700">
                  Organization type
                  <select value={organizationType} onChange={(event) => setOrganizationType(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100">
                    <option>Business / team</option>
                    <option>HOA / condo / residents</option>
                    <option>School / classroom</option>
                    <option>Clinic / professional office</option>
                    <option>Church / nonprofit</option>
                    <option>Customer community</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-black text-slate-700">
                  Estimated members
                  <select value={estimatedMembers} onChange={(event) => setEstimatedMembers(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100">
                    <option>250-500</option>
                    <option>501-1,000</option>
                    <option>1,001-2,500</option>
                    <option>2,501-5,000</option>
                    <option>5,000+</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-black text-slate-700">
                  Requested rooms
                  <select value={requestedRooms} onChange={(event) => setRequestedRooms(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100">
                    <option>1-2</option>
                    <option>3-5</option>
                    <option>6-10</option>
                    <option>11-25</option>
                    <option>25+</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-black text-slate-700">
                  Billing preference
                  <select value={billingPreference} onChange={(event) => setBillingPreference(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100">
                    <option>Monthly</option>
                    <option>Annual</option>
                    <option>Need help deciding</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-black text-slate-700">
                  Requested room name
                  <input value={roomName} onChange={(event) => setRoomName(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100" />
                </label>
              </section>

              <label className="block space-y-2 text-sm font-black text-slate-700">
                Notes
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} placeholder="Tell us what this organization needs: member approval, multiple rooms, calendar/event updates, announcements, onboarding, billing needs, or admin controls." className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100" />
              </label>

              <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 sm:w-auto">
                <Mail className="size-4" />
                Prepare setup request
              </button>
            </form>

            <aside className="space-y-4">
              <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-3">
                  <Building2 className="size-5 text-amber-700" />
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Custom structure</h2>
                </div>
                <ul className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />Multiple private rooms</li>
                  <li className="flex gap-2"><Users className="mt-0.5 size-4 shrink-0 text-emerald-600" />Higher member limits</li>
                  <li className="flex gap-2"><CalendarDays className="mt-0.5 size-4 shrink-0 text-emerald-600" />Calendar and announcement use cases</li>
                  <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />Support-assisted onboarding</li>
                </ul>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <FileText className="size-5 text-slate-700" />
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Pricing path</h2>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">Loombus can quote monthly or annual organization pricing after the request is reviewed. Payment can be handled through a custom Stripe invoice, quote, or payment link.</p>
              </section>
            </aside>
          </div>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
