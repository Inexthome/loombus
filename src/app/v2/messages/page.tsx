"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bell,
  Camera,
  ChevronLeft,
  FileText,
  Home,
  Image,
  Info,
  LinkIcon,
  Loader2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  Smile,
  UserRound,
  Users,
  X,
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

type Thread = {
  name: string;
  note: string;
  time: string;
  unread?: boolean;
  active?: boolean;
  group?: boolean;
  avatar: string;
};

type ChatMessage = {
  from: "them" | "me";
  body: string;
  time: string;
  attachment?: {
    name: string;
    size: string;
  };
  reaction?: string;
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
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell, active: true },
  { label: "Settings", href: "/settings", icon: Settings },
];

const THREADS: Thread[] = [
  { name: "Mason Alvarado", note: "Thanks! I’ll share the deck shortly.", time: "9:41 AM", unread: true, active: true, avatar: "M" },
  { name: "Nadia Karim", note: "Sounds good. Let’s sync tomorrow.", time: "9:12 AM", unread: true, avatar: "N" },
  { name: "Alex Rivera", note: "Got it. I’ll take a look and respond.", time: "Yesterday", avatar: "A" },
  { name: "Builders’ Room Admin", note: "Reminder: Community call today at 4pm.", time: "Yesterday", group: true, avatar: "B" },
  { name: "Civic Futures Lab", note: "New document shared", time: "May 19", group: true, avatar: "C" },
  { name: "Open Systems Lab", note: "Thanks for the update!", time: "May 18", group: true, avatar: "O" },
];

const CHAT_MESSAGES: ChatMessage[] = [
  {
    from: "them",
    body: "Hey Saint, thanks for leading the discussion yesterday. The decentralized identity thread really resonated with the community.",
    time: "9:28 AM",
  },
  {
    from: "me",
    body: "Thanks, Mason. It was a great conversation. I’ll put together a summary and share it here.",
    time: "9:31 AM",
  },
  {
    from: "them",
    body: "Perfect. I also attached the slide deck from our chat on trust models.",
    time: "9:33 AM",
    attachment: { name: "Trust Models Overview.pdf", size: "1.8 MB" },
  },
  {
    from: "me",
    body: "This is helpful. I’ll review it and add the context to the discussion thread.",
    time: "9:37 AM",
  },
  {
    from: "them",
    body: "Awesome. Let me know if you need anything else. Excited to keep building this together.",
    time: "9:40 AM",
    reaction: "👍 1",
  },
  {
    from: "me",
    body: "Will do. Thanks again!",
    time: "9:41 AM",
  },
];

const SHARED_FILES = [
  { name: "Trust Models Overview.pdf", meta: "1.8 MB · PDF", icon: FileText },
  { name: "Decentralized Identity.png", meta: "2.4 MB · PNG", icon: Image },
  { name: "Community Notes.docx", meta: "320 KB · DOCX", icon: FileText },
];

const SHARED_LINKS = [
  { title: "Designing Better Communities", url: "loomb.us/d/better-communities" },
  { title: "Climate Tech Roadmap 2030", url: "loomb.us/d/climate-tech" },
  { title: "Open Systems Lab Results", url: "loomb.us/d/os-results" },
];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
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
              <Link
                key={item.label}
                href={item.href}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  item.active
                    ? "border-b border-white text-white"
                    : item.primary
                      ? "border border-white/40 text-white hover:bg-white/10"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/v2/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Search className="size-5" />
          </Link>
          <Link href="/v2/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Bell className="size-5" />
            <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">3</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 loombus-v2-bottom-nav px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-xs font-semibold text-slate-500">
        {V2_NAV_ITEMS.slice(0, 5).map((item) => {
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
          <Link href="/messages" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">
            Open current Messages
          </Link>
          <Link href="/v2" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">
            Back to V2 Home
          </Link>
        </div>
      </section>
    </main>
  );
}

function Avatar({ label, group = false, size = "md" }: { label: string; group?: boolean; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "size-12" : size === "sm" ? "size-9" : "size-11";
  return (
    <span className={`grid ${sizeClass} shrink-0 place-items-center rounded-full ${group ? "bg-slate-950 text-white" : "bg-gradient-to-br from-slate-200 to-blue-100 text-slate-950"} text-sm font-black`}>
      {group ? <Users className="size-5" /> : label.slice(0, 1)}
    </span>
  );
}

export default function V2MessagesPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");

  const visibleThreads = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return THREADS.filter((thread) => {
      const matchesQuery = !cleanQuery || `${thread.name} ${thread.note}`.toLowerCase().includes(cleanQuery);
      const matchesTab = activeTab === "All" || activeTab === "Archived" || (activeTab === "Unread" && thread.unread);
      return matchesQuery && matchesTab;
    });
  }, [activeTab, query]);

  async function loadShell() {
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 Messages access. Current Messages remains available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadShell();
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <GateCard title="Checking V2 Messages access" message="Loombus is verifying access before loading the V2 Messages shell." loading />;
  }

  if (message) {
    return <GateCard title="V2 Messages check failed safely" message={message} payload={payload} />;
  }

  if (!payload?.authenticated) {
    return <GateCard title="Sign in required" message="The V2 Messages shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <GateCard title="V2 Messages is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on the current Messages experience." payload={payload} />;
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <section className="grid min-h-[760px] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)] lg:grid-cols-[320px_minmax(0,1fr)_300px]">
          <aside className="border-b border-slate-200 bg-white p-5 lg:border-b-0 lg:border-r">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h1 className="text-2xl font-black text-slate-950">Messages</h1>
              <Link href="/messages" className="grid size-10 place-items-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700" aria-label="Compose in current Messages">
                <Plus className="size-5" />
              </Link>
            </div>

            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Search className="size-5 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search messages"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 border-b border-slate-100 pb-2 text-sm font-bold">
              {[{ label: "All", badge: null }, { label: "Unread", badge: "2" }, { label: "Archived", badge: null }].map((tab) => (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setActiveTab(tab.label)}
                  className={`rounded-xl px-3 py-2 transition ${activeTab === tab.label ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-blue-700"}`}
                >
                  {tab.label} {tab.badge && <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{tab.badge}</span>}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              {visibleThreads.map((thread) => (
                <button
                  key={thread.name}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${thread.active ? "bg-blue-50" : "hover:bg-slate-50"}`}
                >
                  <Avatar label={thread.avatar} group={thread.group} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-black text-slate-950">{thread.name}</span>
                      <span className="shrink-0 text-xs font-semibold text-slate-500">{thread.time}</span>
                    </span>
                    <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{thread.note}</span>
                  </span>
                  {thread.unread && <span className="size-2 shrink-0 rounded-full bg-blue-600" />}
                </button>
              ))}
            </div>

            <Link href="/messages" className="mt-5 inline-flex items-center gap-2 rounded-2xl px-2 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-blue-700">
              <Archive className="size-4" />
              View archived
            </Link>
          </aside>

          <section className="flex min-h-[760px] flex-col bg-white">
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <Link href="/v2/messages" className="grid size-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-50 hover:text-blue-700" aria-label="Back to messages">
                  <ChevronLeft className="size-5" />
                </Link>
                <Avatar label="M" size="md" />
                <div>
                  <h2 className="font-black text-slate-950">Mason Alvarado</h2>
                  <p className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span className="size-2 rounded-full bg-emerald-500" /> Online</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-slate-500">
                <button type="button" className="grid size-10 place-items-center rounded-full transition hover:bg-slate-50 hover:text-blue-700"><Camera className="size-5" /></button>
                <button type="button" className="grid size-10 place-items-center rounded-full transition hover:bg-slate-50 hover:text-blue-700"><Phone className="size-5" /></button>
                <button type="button" className="grid size-10 place-items-center rounded-full transition hover:bg-slate-50 hover:text-blue-700"><Info className="size-5" /></button>
              </div>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto bg-white px-5 py-5">
              <div className="text-center"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">Today</span></div>
              {CHAT_MESSAGES.map((chat, index) => (
                <div key={`${chat.time}-${index}`} className={`flex items-end gap-3 ${chat.from === "me" ? "justify-end" : "justify-start"}`}>
                  {chat.from === "them" && <Avatar label="M" size="sm" />}
                  <div className="relative max-w-[72%]">
                    <div className={`rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${chat.from === "me" ? "bg-blue-100 text-blue-950" : "border border-slate-200 bg-slate-50 text-slate-700"}`}>
                      <p>{chat.body}</p>
                      {chat.attachment && (
                        <Link href="/messages" className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-700 transition hover:border-blue-200 hover:bg-blue-50">
                          <span className="flex items-center gap-3"><FileText className="size-8 text-red-500" /><span><span className="block font-black">{chat.attachment.name}</span><span className="block text-xs text-slate-500">{chat.attachment.size}</span></span></span>
                          <Paperclip className="size-4 text-slate-400" />
                        </Link>
                      )}
                      <p className={`mt-1 text-xs font-semibold ${chat.from === "me" ? "text-blue-500" : "text-slate-400"}`}>{chat.time}</p>
                    </div>
                    {chat.reaction && <span className="absolute -bottom-3 right-3 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm">{chat.reaction}</span>}
                  </div>
                </div>
              ))}
            </div>

            <footer className="border-t border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <Link href="/messages" className="grid size-9 place-items-center rounded-full text-blue-600 transition hover:bg-blue-50" aria-label="Attach through current messages"><Paperclip className="size-5" /></Link>
                <Link href="/messages" className="min-w-0 flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-slate-400">Write a message</Link>
                <button type="button" className="grid size-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-50 hover:text-blue-700"><Smile className="size-5" /></button>
                <Link href="/messages" className="grid size-9 place-items-center rounded-full text-blue-600 transition hover:bg-blue-50" aria-label="Send through current messages"><Send className="size-5" /></Link>
              </div>
            </footer>
          </section>

          <aside className="hidden border-l border-slate-200 bg-white p-5 xl:block">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="font-black text-slate-950">Conversation details</h2>
              <button type="button" className="grid size-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-50"><X className="size-4" /></button>
            </div>

            <div className="text-center">
              <Avatar label="M" size="lg" />
              <h3 className="mt-3 font-black text-slate-950">Mason Alvarado</h3>
              <p className="mt-1 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500"><span className="size-2 rounded-full bg-emerald-500" /> Online</p>
              <p className="mt-4 text-sm leading-6 text-slate-500">Head of Community at Loombus</p>
              <p className="text-xs font-semibold text-slate-400">Member since Jan 2024</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link href="/v2/people" className="rounded-2xl border border-slate-200 px-3 py-4 text-center text-xs font-black text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><UserRound className="mx-auto mb-2 size-5" />View profile</Link>
              <button type="button" className="rounded-2xl border border-slate-200 px-3 py-4 text-center text-xs font-black text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Search className="mx-auto mb-2 size-5" />Search chat</button>
            </div>

            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-black text-slate-950">Shared files</h3><Link href="/messages" className="text-xs font-black text-blue-700">See all</Link></div>
              <div className="space-y-3">
                {SHARED_FILES.map((file) => {
                  const Icon = file.icon;
                  return (
                    <div key={file.name} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0">
                      <span className="flex min-w-0 items-center gap-3"><Icon className="size-7 shrink-0 text-blue-600" /><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-700">{file.name}</span><span className="text-xs font-semibold text-slate-400">{file.meta}</span></span></span>
                      <MoreHorizontal className="size-4 shrink-0 text-slate-400" />
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-black text-slate-950">Shared links</h3><Link href="/messages" className="text-xs font-black text-blue-700">See all</Link></div>
              <div className="space-y-3">
                {SHARED_LINKS.map((link) => (
                  <div key={link.title} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0">
                    <span className="flex min-w-0 items-center gap-3"><LinkIcon className="size-7 shrink-0 text-blue-600" /><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-700">{link.title}</span><span className="text-xs font-semibold text-blue-600">{link.url}</span></span></span>
                    <MoreHorizontal className="size-4 shrink-0 text-slate-400" />
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-6 space-y-3 border-t border-slate-100 pt-4">
              <button type="button" className="flex w-full items-center justify-between gap-3 rounded-2xl px-2 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"><span className="inline-flex items-center gap-2"><Bell className="size-4" />Mute notifications</span><span className="h-6 w-10 rounded-full bg-slate-200" /></button>
              <Link href="/messages" className="flex items-center gap-2 rounded-2xl px-2 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-blue-700"><Archive className="size-4" />Archive conversation</Link>
            </div>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
