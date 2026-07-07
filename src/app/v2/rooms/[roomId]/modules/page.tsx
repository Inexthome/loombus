"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, ClipboardList, FileQuestion, FileText, FolderOpen, HelpCircle, LayoutGrid, Megaphone, MessageCircle, Search, Settings, ShoppingBag, Users, Vote } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { V2ShellMobileNav, V2ShellTopNav } from "../../../v2-shell-components";

type Row = Record<string, unknown>;
type ModuleGroup = "Core" | "Operations" | "Knowledge" | "Community" | "Controls";
type LoadState = "checking" | "ready" | "signed_out" | "blocked" | "error";
type ModuleCard = { id: string; label: string; group: ModuleGroup; description: string; href: (roomId: string) => string; icon: typeof LayoutGrid; admin?: boolean };

const MODULES: ModuleCard[] = [
  { id: "home", label: "Room Home", group: "Core", description: "Main hub with live sections, summaries, and status cards.", href: (roomId) => `/rooms/${roomId}`, icon: Building2 },
  { id: "discussions", label: "Discussions", group: "Core", description: "Private room conversations and member posts.", href: (roomId) => `/rooms/${roomId}#discussions`, icon: MessageCircle },
  { id: "calendar", label: "Calendar", group: "Core", description: "Events, meetings, maintenance windows, and important room dates.", href: (roomId) => `/rooms/${roomId}#calendar`, icon: CalendarDays },
  { id: "announcements", label: "Announcements", group: "Core", description: "Pinned owner/admin notices and important updates.", href: (roomId) => `/rooms/${roomId}#announcements`, icon: Megaphone, admin: true },
  { id: "members", label: "Members / Roles", group: "Community", description: "Room members, roles, invites, and access controls.", href: (roomId) => `/rooms/${roomId}#members`, icon: Users, admin: true },
  { id: "tasks", label: "Tasks / Action Items", group: "Operations", description: "Assign and track work, follow-ups, and room action items.", href: (roomId) => `/rooms/${roomId}/tasks`, icon: CheckCircle2 },
  { id: "polls", label: "Polls / Decisions", group: "Operations", description: "Collect votes and record room decisions.", href: (roomId) => `/rooms/${roomId}/polls`, icon: Vote },
  { id: "requests", label: "Requests", group: "Operations", description: "Maintenance, help, support, and general room requests.", href: (roomId) => `/rooms/${roomId}/requests`, icon: ClipboardList },
  { id: "forms", label: "Forms / Submissions", group: "Operations", description: "Create custom forms and review structured member responses.", href: (roomId) => `/rooms/${roomId}/forms`, icon: FileQuestion },
  { id: "faq", label: "Knowledge Base / FAQ", group: "Knowledge", description: "Answers, room instructions, policies, and repeated questions.", href: (roomId) => `/rooms/${roomId}/faq`, icon: HelpCircle },
  { id: "documents", label: "Files / Documents", group: "Knowledge", description: "Bylaws, packets, handbooks, external links, and important documents.", href: (roomId) => `/rooms/${roomId}/documents`, icon: FolderOpen },
  { id: "resources", label: "Resources", group: "Knowledge", description: "Helpful links, guides, room references, and shared resources.", href: (roomId) => `/rooms/${roomId}/resources`, icon: FileText },
  { id: "directory", label: "Directory / Contacts", group: "Community", description: "Important people, vendors, offices, contacts, and emergency references.", href: (roomId) => `/rooms/${roomId}/directory`, icon: Users },
  { id: "services", label: "Services / Store", group: "Community", description: "Room-specific services, listings, offers, and store-style community tools.", href: (roomId) => `/rooms/${roomId}/services`, icon: ShoppingBag },
  { id: "activity", label: "Activity / Audit Log", group: "Controls", description: "Track room changes, approvals, submissions, and admin activity.", href: (roomId) => `/rooms/${roomId}/activity`, icon: ClipboardList, admin: true },
  { id: "settings", label: "Settings / Controls", group: "Controls", description: "Room details, privacy, module visibility, paused state, and admin controls.", href: (roomId) => `/rooms/${roomId}#settings`, icon: Settings, admin: true },
];
const GROUPS: ModuleGroup[] = ["Core", "Operations", "Knowledge", "Community", "Controls"];
function asString(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export default function V2RoomModulesPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] ?? "" : rawRoomId ?? ""), [rawRoomId]);
  const [state, setState] = useState<LoadState>("checking");
  const [roomName, setRoomName] = useState("Room Modules");
  const [message, setMessage] = useState("Loading room modules...");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<ModuleGroup | "All">("All");
  const [canManage, setCanManage] = useState(false);

  const filteredModules = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return MODULES.filter((module) => {
      const groupMatch = group === "All" || module.group === group;
      const searchMatch = !needle || `${module.label} ${module.group} ${module.description}`.toLowerCase().includes(needle);
      return groupMatch && searchMatch;
    });
  }, [query, group]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id ?? null;
        if (!userId) { if (!cancelled) { setState("signed_out"); setMessage("Sign in first so Loombus can open this room module directory."); } return; }
        const [{ data: roomData, error: roomError }, { data: memberData, error: memberError }] = await Promise.all([
          supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
          supabase.from("room_members").select("*").eq("room_id", roomId),
        ]);
        if (roomError) throw roomError;
        if (memberError) throw memberError;
        const room = (roomData ?? {}) as Row;
        const isOwner = asString(room.owner_id) === userId || asString(room.created_by) === userId;
        const members = ((memberData ?? []) as Row[]);
        const currentMember = members.find((member) => asString(member.user_id) === userId);
        const isMember = Boolean(currentMember);
        if (!isOwner && !isMember) { if (!cancelled) { setState("blocked"); setMessage("Room modules are only available to approved room members."); } return; }
        if (!cancelled) {
          setRoomName(asString(room.name) || asString(room.title) || "Room Modules");
          setCanManage(Boolean(isOwner || ["owner", "admin"].includes(asString(currentMember?.role))));
          setState("ready");
          setMessage("");
        }
      } catch {
        if (!cancelled) { setState("error"); setMessage("Loombus could not load this module directory yet."); }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [roomId]);

  return <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950"><V2ShellTopNav /><section className="mx-auto max-w-7xl px-4 pb-24 pt-7 sm:px-6 lg:px-8"><Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700"><ArrowLeft className="size-4" />Back to room</Link>{message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}<section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"><div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8"><p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200" style={{ color: "#fde68a" }}>Room Module Directory</p><h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl" style={{ color: "#ffffff" }}>{roomName}</h1><p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50 sm:text-base" style={{ color: "#fff7ed" }}>A simple control-center view for every tool available inside this private room.</p><div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]"><span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{MODULES.length} modules</span><span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{GROUPS.length} groups</span><span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{canManage ? "Admin view" : "Member view"}</span></div></div>{state === "ready" ? <div className="p-5 sm:p-6"><div className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm lg:flex-row"><label className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Search modules, workflows, or groups" /></label><select value={group} onChange={(event) => setGroup(event.target.value as ModuleGroup | "All")} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100"><option value="All">All groups</option>{GROUPS.map((nextGroup) => <option key={nextGroup} value={nextGroup}>{nextGroup}</option>)}</select></div><div className="mt-5 space-y-6">{GROUPS.map((nextGroup) => { const cards = filteredModules.filter((module) => module.group === nextGroup); if (!cards.length) return null; return <section key={nextGroup}><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">{nextGroup}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 ring-1 ring-slate-200">{cards.length} tools</span></div><div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards.map((module) => { const Icon = module.icon; return <Link key={module.id} href={module.href(roomId)} className="group block rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100"><Icon className="size-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black text-slate-950 group-hover:text-amber-800">{module.label}</h3>{module.admin && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100">admin</span>}</div><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{module.description}</p></div></div></Link>; })}</div></section>; })}</div>{!filteredModules.length && <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center"><LayoutGrid className="mx-auto size-9 text-amber-700" /><h2 className="mt-3 text-lg font-black text-slate-950">No modules found</h2><p className="mt-2 text-sm leading-6 text-slate-600">Try a different search or group filter.</p></div>}</div> : <div className="p-6"><div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm"><LayoutGrid className="mx-auto size-9 text-amber-700" /><h2 className="mt-3 text-lg font-black text-slate-950">{state === "checking" ? "Checking module access" : state === "signed_out" ? "Sign in required" : state === "blocked" ? "Modules are private" : "Module directory could not load"}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{message}</p></div></div>}</section></section><V2ShellMobileNav /></main>;
}
