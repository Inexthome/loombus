"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronRight,
  FlaskConical,
  Home,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  ThumbsUp,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type FeatureFlags = {
  v2_shell: boolean;
  v2_signal_brief: boolean;
  v2_rooms: boolean;
};

type ShellPayload = {
  version: "v1" | "v2";
  configured: boolean;
  authenticated: boolean;
  flags: FeatureFlags;
};

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

type LabsFeatureRequestStatus = "submitted" | "reviewing" | "planned" | "shipped" | "declined";

type LabsFeatureRequest = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: LabsFeatureRequestStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  vote_count: number;
  voted_by_me: boolean;
};

type RequestFilter = "All" | "Submitted" | "Reviewing" | "Planned" | "Shipped" | "Declined" | "My requests";

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const STATUS_LABELS: Record<LabsFeatureRequestStatus, string> = {
  submitted: "Submitted",
  reviewing: "Reviewing",
  planned: "Planned",
  shipped: "Shipped",
  declined: "Declined",
};

const STATUS_CLASSES: Record<LabsFeatureRequestStatus, string> = {
  submitted: "bg-slate-100 text-slate-700",
  reviewing: "bg-blue-50 text-blue-700",
  planned: "bg-violet-50 text-violet-700",
  shipped: "bg-emerald-50 text-emerald-700",
  declined: "bg-rose-50 text-rose-700",
};

const FILTERS: RequestFilter[] = ["All", "Submitted", "Reviewing", "Planned", "Shipped", "Declined", "My requests"];

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
  { label: "People", href: "/v2/people", icon: Users },
];

const MOBILE_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Labs", href: "/v2/labs", icon: FlaskConical, active: true },
];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function hasLabsVotingAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin || entitlement?.tier === "admin") return true;
  const isPremiumPlus = entitlement?.tier === "premium_plus" || (entitlement?.tier === "premium" && (entitlement.monthly_summary_limit ?? 0) > 50);
  return entitlement?.ai_assisted_enabled === true && isPremiumPlus;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function statusFromFilter(filter: RequestFilter): LabsFeatureRequestStatus | null {
  if (filter === "Submitted") return "submitted";
  if (filter === "Reviewing") return "reviewing";
  if (filter === "Planned") return "planned";
  if (filter === "Shipped") return "shipped";
  if (filter === "Declined") return "declined";
  return null;
}

function GateCard({ title, message, loading = false, payload }: { title: string; message: string; loading?: boolean; payload?: ShellPayload | null }) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-300/20">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>
        {payload && <p className="mt-5 text-xs text-slate-300">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</p>}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">Back to V2 Home</Link>
          <Link href="/labs" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current Labs</Link>
        </div>
      </section>
    </main>
  );
}

function V2TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] loombus-v2-top-nav shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/v2" className="flex items-center gap-3 font-bold">
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 object-contain" />
          <span className="text-xl">Loombus</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {V2_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${item.primary ? "border border-white/40 text-white hover:bg-white/10" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/v2/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Search className="size-5" /></Link>
          <Link href="/v2/notifications" aria-label="Notifications" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Bell className="size-5" /></Link>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 loombus-v2-bottom-nav px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-xs font-semibold text-slate-500">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${item.active ? "text-blue-600" : "text-slate-500"}`}>
              <Icon className={`size-5 ${item.primary ? "rounded-full bg-blue-600 p-1 text-white" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function RequestCard({ request, currentUserId, canVote, onVote }: { request: LabsFeatureRequest; currentUserId: string | null; canVote: boolean; onVote: (requestId: string) => void }) {
  const mine = request.user_id === currentUserId;
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${STATUS_CLASSES[request.status]}`}>{STATUS_LABELS[request.status]}</span>
            {mine && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">Your request</span>}
            <span className="text-xs font-semibold text-slate-400">Submitted {formatDate(request.created_at)}</span>
          </div>
          <h2 className="mt-3 text-xl font-black text-slate-950">{request.title}</h2>
          <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600">{request.description}</p>
          {request.admin_note && <p className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800"><span className="font-black">Admin note:</span> {request.admin_note}</p>}
        </div>
        <div className="flex shrink-0 gap-2 sm:flex-col sm:items-stretch">
          <button type="button" onClick={() => onVote(request.id)} disabled={!canVote} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${request.voted_by_me ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-200 bg-white text-blue-700 hover:border-blue-200 hover:bg-blue-50"} disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400`}>
            <ThumbsUp className="size-4" /> {request.vote_count}
          </button>
          <Link href="/labs" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">V1 View <ChevronRight className="size-4" /></Link>
        </div>
      </div>
    </article>
  );
}

export default function V2LabsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entitlement, setEntitlement] = useState<AiEntitlement>(null);
  const [requests, setRequests] = useState<LabsFeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [labsLoading, setLabsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<RequestFilter>("All");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const canVoteLabs = hasLabsVotingAccess(entitlement, isAdmin);

  const statusCounts = useMemo(() => requests.reduce<Record<LabsFeatureRequestStatus, number>>((counts, request) => {
    counts[request.status] = (counts[request.status] ?? 0) + 1;
    return counts;
  }, { submitted: 0, reviewing: 0, planned: 0, shipped: 0, declined: 0 }), [requests]);

  const filteredRequests = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const statusFilter = statusFromFilter(activeFilter);
    return requests.filter((request) => {
      const matchesQuery = !cleanQuery || `${request.title} ${request.description} ${request.status} ${request.admin_note ?? ""}`.toLowerCase().includes(cleanQuery);
      const matchesFilter = activeFilter === "All" || (activeFilter === "My requests" && request.user_id === currentUserId) || request.status === statusFilter;
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, currentUserId, query, requests]);

  const topRequests = useMemo(() => [...requests].sort((a, b) => b.vote_count - a.vote_count).slice(0, 3), [requests]);

  async function loadLabs(userId: string) {
    setLabsLoading(true);
    setMessage("");
    try {
      const [{ data: profileData }, { data: entitlementData }, { data: requestData, error: requestError }] = await Promise.all([
        supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle(),
        supabase.from("user_ai_entitlements").select("tier, ai_assisted_enabled, monthly_summary_limit").eq("user_id", userId).maybeSingle(),
        supabase.from("labs_feature_requests").select("id, user_id, title, description, status, admin_note, reviewed_at, created_at, updated_at").order("created_at", { ascending: false }),
      ]);

      if (requestError) {
        setMessage(`Unable to load Labs requests: ${requestError.message}`);
        setRequests([]);
        return;
      }

      const resolvedEntitlement = (entitlementData ?? null) as AiEntitlement;
      setIsAdmin(Boolean(profileData?.is_admin) || resolvedEntitlement?.tier === "admin");
      setEntitlement(resolvedEntitlement);

      const loadedRequests = (requestData ?? []) as Omit<LabsFeatureRequest, "vote_count" | "voted_by_me">[];
      const requestIds = loadedRequests.map((request) => request.id);
      let voteRows: { request_id: string; user_id: string }[] = [];

      if (requestIds.length > 0) {
        const { data: votes } = await supabase.from("labs_feature_request_votes").select("request_id, user_id").in("request_id", requestIds);
        voteRows = (votes ?? []) as { request_id: string; user_id: string }[];
      }

      const voteCounts = voteRows.reduce<Record<string, number>>((counts, vote) => {
        counts[vote.request_id] = (counts[vote.request_id] ?? 0) + 1;
        return counts;
      }, {});
      const myVotes = new Set(voteRows.filter((vote) => vote.user_id === userId).map((vote) => vote.request_id));

      setRequests(loadedRequests.map((request) => ({ ...request, vote_count: voteCounts[request.id] ?? 0, voted_by_me: myVotes.has(request.id) })));
    } catch {
      setMessage("Unable to load V2 Labs safely. Current Labs remains available.");
      setRequests([]);
    } finally {
      setLabsLoading(false);
    }
  }

  async function loadShell() {
    setLoading(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
      setCurrentUserId(data.session?.user.id ?? null);
      if (data.session?.user.id && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") await loadLabs(data.session.user.id);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 Labs access. Current Labs remains available.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleVote(requestId: string) {
    setMessage("");
    if (!currentUserId) return;
    if (!canVoteLabs) {
      setMessage("Labs voting is available to Premium Plus and admin accounts.");
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    try {
      const response = await fetch("/api/labs/requests/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ requestId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error ?? "Unable to update Labs vote.");
        return;
      }
      setRequests((current) => current.map((request) => request.id === requestId ? { ...request, vote_count: result.voteCount ?? request.vote_count, voted_by_me: Boolean(result.voted) } : request));
    } catch {
      setMessage("Unable to update Labs vote.");
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!currentUserId || submitting) return;
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (cleanTitle.length < 3) {
      setMessage("Feature request title must be at least 3 characters.");
      return;
    }
    if (cleanDescription.length < 10) {
      setMessage("Feature request description must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return;
      const response = await fetch("/api/labs/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ title: cleanTitle, description: cleanDescription }),
      });
      const result = (await response.json().catch(() => ({}))) as { request?: Omit<LabsFeatureRequest, "vote_count" | "voted_by_me">; error?: string };
      if (!response.ok || !result.request) {
        setMessage(result.error ?? "Unable to submit feature request.");
        return;
      }
      setRequests((current) => [{ ...result.request!, vote_count: 0, voted_by_me: false }, ...current]);
      setTitle("");
      setDescription("");
      setMessage("Feature request submitted to Loombus Labs.");
    } catch {
      setMessage("Unable to submit feature request.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <GateCard title="Checking V2 Labs access" message="Loombus is verifying access before loading the V2 Labs shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 Labs shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 Labs is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Labs</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Submit feature requests, follow review status, and help shape what gets built next.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Labs requests" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
              <button type="button" className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><SlidersHorizontal className="size-5" /></button>
            </div>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>{filter}</button>)}
            </div>

            {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
            {labsLoading && <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading Labs requests...</div>}

            <section className="mb-5 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Sparkles className="size-5" /></span>
                <div>
                  <h2 className="text-lg font-black text-slate-950">Submit a Labs request</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Tell Loombus what would make the platform more useful, focused, or valuable for high-signal discussion.</p>
                </div>
              </div>
              <form onSubmit={submitRequest} className="mt-5 space-y-4">
                <div><label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Feature title</label><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Example: Saved discussion tags" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300" /><p className="mt-2 text-xs font-semibold text-slate-400">{title.length}/120 characters</p></div>
                <div><label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Why should this exist?</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={5} placeholder="Describe the problem, who it helps, and how it should work..." className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300" /><p className="mt-2 text-xs font-semibold text-slate-400">{description.length}/2000 characters</p></div>
                <button type="submit" disabled={submitting} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">{submitting ? "Submitting..." : "Submit request"}</button>
              </form>
            </section>

            <div className="space-y-3">
              {!labsLoading && filteredRequests.length === 0 && <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">No Labs requests match this V2 filter.</div>}
              {!labsLoading && filteredRequests.map((request) => <RequestCard key={request.id} request={request} currentUserId={currentUserId} canVote={canVoteLabs} onVote={toggleVote} />)}
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Request status</h2><Link href="/labs" className="text-sm font-black text-blue-700">V1 Labs</Link></div>
              <div className="mt-4 space-y-3">
                {(Object.keys(STATUS_LABELS) as LabsFeatureRequestStatus[]).map((status) => <div key={status} className="flex items-center justify-between rounded-2xl px-1 py-2"><span className="inline-flex items-center gap-3 text-sm font-black text-slate-800"><span className={`size-3 rounded-full ${status === "shipped" ? "bg-emerald-500" : status === "planned" ? "bg-violet-500" : status === "reviewing" ? "bg-blue-500" : status === "declined" ? "bg-rose-500" : "bg-slate-400"}`} />{STATUS_LABELS[status]}</span><span className="font-black text-blue-700">{statusCounts[status] ?? 0}</span></div>)}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Top requests</h2>
              <div className="mt-4 space-y-4">
                {topRequests.length === 0 && <p className="text-sm leading-6 text-slate-500">Submitted requests will appear here.</p>}
                {topRequests.map((request) => <Link key={request.id} href="/v2/labs" className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{request.title}</span><span className="block text-xs font-semibold text-slate-500">{STATUS_LABELS[request.status]} · {request.vote_count} votes</span></span><ChevronRight className="size-4 shrink-0 text-slate-400" /></Link>)}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Labs access</h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <p><ShieldCheck className="mr-2 inline size-4 text-blue-700" />Signed-in members can submit requests.</p>
                <p><ThumbsUp className="mr-2 inline size-4 text-blue-700" />Premium Plus and admins can vote on requests.</p>
                {isAdmin && <Link href="/admin/labs" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-50">Open Admin Labs <ChevronRight className="size-4" /></Link>}
              </div>
            </section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
