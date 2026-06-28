"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AtSign,
  Bell,
  BellOff,
  Check,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Home,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Target,
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

type NotificationKind = "Replies" | "Mentions" | "Messages" | "Rooms" | "Labs" | "System";
type NotificationTone = "blue" | "violet" | "green" | "amber" | "orange";

type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  target: string;
  preview: string;
  chip: string;
  time: string;
  group: "Today" | "Yesterday";
  icon: LucideIcon;
  tone: NotificationTone;
  unread?: boolean;
  avatarSeed?: string;
};

type PreferenceItem = {
  label: string;
  value: string;
  icon: LucideIcon;
};

type MutedSource = {
  title: string;
  meta: string;
  icon: LucideIcon;
  tone: NotificationTone;
};

type AttentionItem = {
  label: string;
  value: number;
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users, active: true },
  { label: "Messages", href: "/v2/messages", icon: Mail },
  { label: "People", href: "/v2/people", icon: Users },
];

const MOBILE_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Mail },
];

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "reply-mason",
    kind: "Replies",
    title: "Mason Alvarado replied to your discussion",
    target: "The Future of Decentralized Identity",
    preview: "Interoperability is still the hardest piece. Without shared standards...",
    chip: "Discussion",
    time: "9:41 AM",
    group: "Today",
    icon: MessageCircle,
    tone: "blue",
    unread: true,
    avatarSeed: "MA",
  },
  {
    id: "mention-nadia",
    kind: "Mentions",
    title: "Nadia Karim mentioned you in a discussion",
    target: "Should AI labs be regulated?",
    preview: "@saint What are your thoughts on risk frameworks?",
    chip: "Discussion",
    time: "9:12 AM",
    group: "Today",
    icon: AtSign,
    tone: "violet",
    unread: true,
    avatarSeed: "NK",
  },
  {
    id: "message-alex",
    kind: "Messages",
    title: "Alex Rivera sent you a message",
    target: "Deck summary and next steps",
    preview: "Hey Saint, sharing the slides and notes from our call.",
    chip: "Message",
    time: "8:47 AM",
    group: "Today",
    icon: Mail,
    tone: "blue",
    unread: true,
    avatarSeed: "AR",
  },
  {
    id: "room-builders",
    kind: "Rooms",
    title: "Builders’ Room",
    target: "James Wu posted a building update",
    preview: "We shipped auth v2.1 and improved onboarding flow.",
    chip: "Room Update",
    time: "8:30 AM",
    group: "Today",
    icon: Users,
    tone: "green",
    unread: true,
    avatarSeed: "JW",
  },
  {
    id: "lab-open-systems",
    kind: "Labs",
    title: "Mira Patel updated Open Systems Lab",
    target: "New experiment results available",
    preview: "We’ve published results from Experiment 23B.",
    chip: "Lab Update",
    time: "Yesterday",
    group: "Yesterday",
    icon: FlaskConical,
    tone: "violet",
    unread: true,
    avatarSeed: "MP",
  },
  {
    id: "system-search",
    kind: "System",
    title: "System Notice",
    target: "We’ve improved search performance",
    preview: "Search is now faster and more relevant across Loombus.",
    chip: "System",
    time: "Yesterday",
    group: "Yesterday",
    icon: Bell,
    tone: "orange",
    unread: true,
  },
];

const PREFERENCES: PreferenceItem[] = [
  { label: "Email Notifications", value: "On", icon: Mail },
  { label: "Push Notifications", value: "On", icon: Bell },
  { label: "In-App Notifications", value: "On", icon: Bell },
  { label: "Digest Summary", value: "Daily", icon: Mail },
];

const MUTED_SOURCES: MutedSource[] = [
  { title: "Climate Solutions Hub", meta: "Room", icon: Users, tone: "green" },
  { title: "AI Safety", meta: "Lab", icon: FlaskConical, tone: "blue" },
  { title: "Web3 Governance", meta: "Topic", icon: ShieldCheck, tone: "violet" },
];

const ATTENTION_ITEMS: AttentionItem[] = [
  { label: "Unread Notifications", value: 8 },
  { label: "Unresolved Mentions", value: 2 },
  { label: "Unread Messages", value: 1 },
];

const BENEFITS = [
  { label: "One Signal Center", detail: "All updates from discussions, messages, rooms, labs, and system in one place.", icon: Target },
  { label: "Unread at a Glance", detail: "Quickly see what’s new with smart filters and unread indicators.", icon: Bell },
  { label: "Fine-Tuned Alerts", detail: "Customize how, when, and where you get notified.", icon: SlidersHorizontal },
  { label: "Stay Informed", detail: "Digests, quiet hours, and controls keep focus on what matters.", icon: Bell },
];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function getToneClass(tone: NotificationTone) {
  if (tone === "violet") return "bg-violet-600 text-white";
  if (tone === "green") return "bg-emerald-600 text-white";
  if (tone === "amber") return "bg-amber-500 text-white";
  if (tone === "orange") return "bg-orange-500 text-white";
  return "bg-blue-600 text-white";
}

function getMutedToneClass(tone: NotificationTone) {
  if (tone === "violet") return "bg-violet-50 text-violet-700";
  if (tone === "green") return "bg-emerald-50 text-emerald-700";
  if (tone === "orange") return "bg-orange-50 text-orange-700";
  return "bg-blue-50 text-blue-700";
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
          <Link href="/notifications" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current Notifications</Link>
        </div>
      </section>
    </main>
  );
}

function V2TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] text-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/v2" className="flex items-center gap-3 font-bold">
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 object-contain" />
          <span className="text-xl">Loombus</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {V2_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${item.active ? "bg-white/10 text-white underline underline-offset-[18px]" : item.primary ? "border border-white/40 text-white hover:bg-white/10" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/v2/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Search className="size-5" /></Link>
          <Link href="/v2/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-white transition hover:bg-white/10"><Bell className="size-5" /><span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">8</span></Link>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-xs font-semibold text-slate-500">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="flex flex-col items-center gap-1 rounded-2xl py-2 text-slate-500">
              <Icon className={`size-5 ${item.primary ? "rounded-full bg-blue-600 p-1 text-white" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NotificationAvatar({ item }: { item: NotificationItem }) {
  const Icon = item.icon;
  return (
    <div className="flex items-center gap-3">
      <span className={`grid size-11 shrink-0 place-items-center rounded-full ${getToneClass(item.tone)}`}><Icon className="size-5" /></span>
      {item.avatarSeed && <span className="hidden size-11 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-black text-white sm:grid">{item.avatarSeed}</span>}
    </div>
  );
}

function NotificationRow({ item }: { item: NotificationItem }) {
  return (
    <Link href={item.kind === "Messages" ? "/v2/messages" : item.kind === "Rooms" ? "/v2/rooms" : item.kind === "Labs" ? "/v2/labs" : "/v2/discussions"} className="flex flex-col gap-4 border-b border-slate-100 px-4 py-5 transition last:border-b-0 hover:bg-blue-50/50 sm:flex-row sm:items-start">
      <NotificationAvatar item={item} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-black text-slate-950">{item.title}</h3>
          <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-black text-violet-700">{item.chip}</span>
        </div>
        <p className="mt-1 text-sm font-black text-blue-900">{item.target}</p>
        <p className="mt-1 max-w-3xl truncate text-sm leading-6 text-slate-600">{item.preview}</p>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-4 sm:w-24 sm:justify-end">
        <span className="text-xs font-semibold text-blue-900">{item.time}</span>
        {item.unread && <span className="size-2.5 rounded-full bg-blue-600" />}
      </div>
    </Link>
  );
}

export default function V2NotificationsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"All" | NotificationKind>("All");

  const filters: Array<{ label: "All" | NotificationKind; count: number }> = useMemo(() => [
    { label: "All", count: NOTIFICATIONS.length + 2 },
    { label: "Replies", count: 3 },
    { label: "Mentions", count: 2 },
    { label: "Messages", count: 1 },
    { label: "Rooms", count: 1 },
    { label: "Labs", count: 1 },
    { label: "System", count: 1 },
  ], []);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "All") return NOTIFICATIONS;
    return NOTIFICATIONS.filter((item) => item.kind === activeFilter);
  }, [activeFilter]);

  const today = filteredNotifications.filter((item) => item.group === "Today");
  const yesterday = filteredNotifications.filter((item) => item.group === "Yesterday");

  async function loadShell() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
    } catch {
      setPayload(getDefaultShellPayload());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <GateCard title="Checking V2 Notifications access" message="Loombus is verifying access before loading the V2 Notifications shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 Notifications shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 Notifications is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Notifications</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">See what needs your attention across discussions, messages, rooms, and labs.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Check className="size-4" />Mark all as read</button>
            <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><SlidersHorizontal className="size-4" />Filter</button>
            <Link href="/settings" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Settings className="size-4" />Notification Settings</Link>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {filters.map((filter) => <button key={filter.label} type="button" onClick={() => setActiveFilter(filter.label)} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${activeFilter === filter.label ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>{filter.label}<span className={`${activeFilter === filter.label ? "bg-white/20 text-white" : "bg-blue-50 text-blue-700"} grid size-6 place-items-center rounded-full text-xs`}>{filter.count}</span></button>)}
            </div>

            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
              {today.length > 0 && <h2 className="px-4 pt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-600">Today</h2>}
              {today.map((item) => <NotificationRow key={item.id} item={item} />)}
              {yesterday.length > 0 && <h2 className="border-t border-slate-100 px-4 pt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-600">Yesterday</h2>}
              {yesterday.map((item) => <NotificationRow key={item.id} item={item} />)}
              {filteredNotifications.length === 0 && <div className="p-6 text-sm font-semibold text-slate-500">No notifications match this filter.</div>}
            </section>
            <button type="button" className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-black text-blue-700 transition hover:bg-blue-50">Load more notifications <ChevronDown className="size-4" /></button>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Notification Preferences</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Choose how and when you receive notifications.</p>
              <div className="mt-4 space-y-4">
                {PREFERENCES.map((item) => {
                  const Icon = item.icon;
                  return <div key={item.label} className="flex items-center justify-between gap-3 text-sm"><span className="inline-flex items-center gap-3 font-semibold text-slate-700"><Icon className="size-4 text-blue-700" />{item.label}</span><span className="font-black text-blue-700">{item.value}</span></div>;
                })}
              </div>
              <Link href="/settings" className="mt-5 flex items-center justify-between text-sm font-black text-blue-700">Manage Preferences <ChevronRight className="size-4" /></Link>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Muted Sources</h2><Link href="/settings" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-3">
                {MUTED_SOURCES.map((item) => {
                  const Icon = item.icon;
                  return <div key={item.title} className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-3"><span className={`grid size-10 place-items-center rounded-xl ${getMutedToneClass(item.tone)}`}><Icon className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="block text-xs font-semibold text-slate-500">{item.meta}</span></span></span><BellOff className="size-4 text-slate-500" /></div>;
                })}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Quiet Hours</h2><span className="inline-flex items-center gap-1 text-sm font-black text-blue-700"><Moon className="size-4" />On</span></div>
              <div className="mt-4 flex items-center justify-between text-sm"><span className="font-semibold text-slate-600">10:00 PM — 7:00 AM</span><span className="font-black text-slate-700">Daily</span></div>
              <Link href="/settings" className="mt-5 flex items-center justify-between text-sm font-black text-blue-700">Edit Quiet Hours <ChevronRight className="size-4" /></Link>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Needs Attention</h2>
              <div className="mt-4 space-y-3">
                {ATTENTION_ITEMS.map((item) => <div key={item.label} className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-700">{item.label}</span><span className="font-black text-blue-700">{item.value}</span></div>)}
              </div>
              <Link href="/v2/notifications" className="mt-5 flex items-center justify-between text-sm font-black text-blue-700">View All <ChevronRight className="size-4" /></Link>
            </section>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return <article key={benefit.label} className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm"><span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-5" /></span><h3 className="mt-3 text-sm font-black text-blue-700">{benefit.label}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{benefit.detail}</p></article>;
          })}
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
