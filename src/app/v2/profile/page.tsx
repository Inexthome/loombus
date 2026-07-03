"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  Bookmark,
  BookOpen,
  CalendarDays,
  Edit3,
  Eye,
  Globe2,
  Loader2,
  MessageCircle,
  Reply,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../v2-shell-components";

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  perspective_marker: string | null;
  creator_website_url: string | null;
  creator_support_url: string | null;
  creator_support_label: string | null;
};

type DiscussionRow = { id: string; title: string; topic: string | null; body: string | null; created_at: string };
type ReplyRow = { id: string; discussion_id: string; body: string | null; created_at: string };
type ReplyCard = ReplyRow & { discussionTitle: string; discussionTopic: string | null };
type ProfileStats = { discussions: number; replies: number; signals: number; saved: number };
type ProfileData = { profile: ProfileRow | null; stats: ProfileStats; discussions: DiscussionRow[]; replies: ReplyCard[]; topics: string[] };
type ProfileFormState = { fullName: string; username: string; bio: string; perspectiveMarker: string; avatarUrl: string; creatorWebsiteUrl: string; creatorSupportUrl: string; creatorSupportLabel: string };

const DEFAULT_STATS: ProfileStats = { discussions: 0, replies: 0, signals: 0, saved: 0 };
const PROFILE_TABS = ["Overview", "Discussions", "Replies", "Contributions"];
const PERSPECTIVE_MARKERS = ["", "Lived experience", "Professional experience", "Research-based", "Builder / operator", "Student / learner", "Question / exploring"];

function isV2Allowed(payload: ShellPayload | null) { return Boolean(payload?.authenticated && payload.configured && payload.flags.v2_shell && payload.version === "v2"); }
function stripHtml(value: string | null | undefined) { return (value ?? "").replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function truncate(value: string, maxLength = 130) { return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trim()}…`; }
function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Recently";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const diffMs = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < hour) return `${Math.max(1, Math.round(diffMs / minute))}m ago`;
  if (diffMs < day) return `${Math.round(diffMs / hour)}h ago`;
  if (diffMs < 7 * day) return `${Math.round(diffMs / day)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function formatCount(value: number) { if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`; if (value >= 1000) return `${(value / 1000).toFixed(1)}k`; return String(Math.max(0, value)); }
function getDisplayName(profile: ProfileRow | null) { return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member"; }
function getUsername(profile: ProfileRow | null) { const username = profile?.username?.trim(); return username ? `@${username}` : "@profile"; }
function getInitials(profile: ProfileRow | null) { const label = getDisplayName(profile); return label.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "L"; }
function isValidOptionalUrl(value: string) { const clean = value.trim(); return !clean || /^https?:\/\//i.test(clean); }
function profileToForm(profile: ProfileRow | null): ProfileFormState { return { fullName: profile?.full_name ?? "", username: profile?.username ?? "", bio: profile?.bio ?? "", perspectiveMarker: profile?.perspective_marker ?? "", avatarUrl: profile?.avatar_url ?? "", creatorWebsiteUrl: profile?.creator_website_url ?? "", creatorSupportUrl: profile?.creator_support_url ?? "", creatorSupportLabel: profile?.creator_support_label ?? "" }; }

async function loadProfileData(viewerId: string): Promise<ProfileData> {
  const [profileResult, discussionCountResult, replyCountResult, savedCountResult, discussionListResult, replyListResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, username, avatar_url, bio, perspective_marker, creator_website_url, creator_support_url, creator_support_label").eq("id", viewerId).maybeSingle(),
    supabase.from("discussions").select("id", { count: "exact", head: true }).eq("user_id", viewerId).is("deleted_at", null),
    supabase.from("replies").select("id", { count: "exact", head: true }).eq("user_id", viewerId).is("deleted_at", null),
    supabase.from("bookmarks").select("id", { count: "exact", head: true }).eq("user_id", viewerId),
    supabase.from("discussions").select("id, title, topic, body, created_at").eq("user_id", viewerId).is("deleted_at", null).order("created_at", { ascending: false }).limit(8),
    supabase.from("replies").select("id, discussion_id, body, created_at").eq("user_id", viewerId).is("deleted_at", null).order("created_at", { ascending: false }).limit(8),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (discussionCountResult.error) throw discussionCountResult.error;
  if (replyCountResult.error) throw replyCountResult.error;
  if (savedCountResult.error) throw savedCountResult.error;
  if (discussionListResult.error) throw discussionListResult.error;
  if (replyListResult.error) throw replyListResult.error;
  const replyRows = (replyListResult.data ?? []) as ReplyRow[];
  const discussionIds = [...new Set(replyRows.map((reply) => reply.discussion_id).filter(Boolean))];
  let replyDiscussionMap = new Map<string, DiscussionRow>();
  if (discussionIds.length > 0) {
    const { data: replyDiscussionData, error: replyDiscussionError } = await supabase.from("discussions").select("id, title, topic, body, created_at").in("id", discussionIds).is("deleted_at", null);
    if (replyDiscussionError) throw replyDiscussionError;
    replyDiscussionMap = new Map(((replyDiscussionData ?? []) as DiscussionRow[]).map((discussion) => [discussion.id, discussion]));
  }
  const discussions = (discussionListResult.data ?? []) as DiscussionRow[];
  const replies = replyRows.map((reply) => { const discussion = replyDiscussionMap.get(reply.discussion_id); return { ...reply, discussionTitle: discussion?.title ?? "Discussion", discussionTopic: discussion?.topic ?? null }; });
  const discussionCount = discussionCountResult.count ?? 0;
  const replyCount = replyCountResult.count ?? 0;
  const savedCount = savedCountResult.count ?? 0;
  const topics = [...new Set(discussions.map((discussion) => discussion.topic).filter((topic): topic is string => Boolean(topic)))].slice(0, 6);
  return { profile: (profileResult.data ?? null) as ProfileRow | null, stats: { discussions: discussionCount, replies: replyCount, signals: discussionCount + replyCount + savedCount, saved: savedCount }, discussions, replies, topics };
}

function CompactProfileAvatar({ profile, className }: { profile: ProfileRow | null; className: string }) {
  const avatarUrl = profile?.avatar_url?.trim();
  if (avatarUrl) return <img src={avatarUrl} alt="" className={`${className} shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm`} />;
  return <span className={`${className} grid shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-black text-white ring-2 ring-white shadow-sm`}>{getInitials(profile)}</span>;
}

function ProfileHero({ profile, stats, topics, onEdit }: { profile: ProfileRow | null; stats: ProfileStats; topics: string[]; onEdit: () => void }) {
  const displayName = getDisplayName(profile);
  const username = getUsername(profile);
  const bio = stripHtml(profile?.bio) || "Share who you are, what you care about, and how others can understand your perspective.";
  const perspective = profile?.perspective_marker?.trim() || "Contributor";
  const avatarUrl = profile?.avatar_url?.trim();
  const statItems = [
    { label: "Discussions", value: stats.discussions, icon: BookOpen },
    { label: "Replies", value: stats.replies, icon: Reply },
    { label: "Signals", value: stats.signals, icon: Sparkles },
    { label: "Saved", value: stats.saved, icon: Bookmark },
  ];
  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm sm:rounded-[1.75rem] sm:shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
      <div className="h-16 bg-[radial-gradient(circle_at_top_left,rgba(214,168,79,0.22),transparent_32%),linear-gradient(120deg,#fff8e6,#f8fafc)] sm:h-24" />
      <div className="px-4 pb-4 sm:px-7 sm:pb-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:gap-5 sm:pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
            <div className="-mt-10 grid size-20 place-items-center overflow-hidden rounded-full border-[3px] border-white bg-slate-950 text-xl font-black text-white shadow-lg sm:-mt-12 sm:size-28 sm:border-4 sm:text-2xl sm:shadow-xl">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : getInitials(profile)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{displayName}</h2><BadgeCheck className="size-4 text-amber-700 sm:size-5" /></div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 sm:text-sm"><span>{username}</span><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700 sm:px-2.5 sm:py-1 sm:text-xs">{perspective}</span></div>
              <p className="mt-2 max-w-2xl text-sm leading-5 text-slate-600 sm:mt-3 sm:leading-6">{truncate(bio, 145)}</p>
              <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">{(topics.length > 0 ? topics : ["No topics yet"]).map((tag) => <span key={tag} className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200 sm:px-3 sm:text-xs">{tag}</span>)}</div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-500 sm:mt-4 sm:gap-4 sm:text-sm"><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5 sm:size-4" /> Public profile</span><span className="inline-flex items-center gap-1.5"><Eye className="size-3.5 sm:size-4" /> Visible overview</span></div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 sm:flex-wrap sm:gap-3">
            <button type="button" onClick={onEdit} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-300 px-3 py-2.5 text-sm font-black text-slate-950 shadow-amber-900/10 transition hover:bg-amber-400 sm:flex-none sm:px-5 sm:py-3 sm:shadow-lg"><Edit3 className="size-4" />Edit</button>
            <Link href="/v2/settings" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-black text-slate-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800 sm:flex-none sm:px-5 sm:py-3"><Settings className="size-4" />Settings</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-4 sm:grid-cols-4 sm:gap-3 sm:pt-5">
          {statItems.map((item) => { const Icon = item.icon; return <div key={item.label} className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 py-2 text-center sm:border-r sm:border-y-0 sm:border-l-0 sm:bg-white sm:last:border-r-0"><Icon className="size-4 text-amber-700" /><div><p className="text-base font-black text-slate-950">{formatCount(item.value)}</p><p className="text-xs font-semibold text-slate-500">{item.label}</p></div></div>; })}
        </div>
      </div>
    </section>
  );
}

function ProfileEditor({ form, setForm, saving, onSubmit, onCancel }: { form: ProfileFormState; setForm: (next: ProfileFormState) => void; saving: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return (
    <section className="rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 shadow-sm sm:rounded-[1.75rem] sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-black text-slate-950 sm:text-xl">Edit public profile</h2><p className="mt-1 text-sm font-semibold text-slate-600">These fields power your visible Loombus profile.</p></div><button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-black text-slate-600 transition hover:text-slate-950 disabled:opacity-60">Cancel</button></div>
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-black text-slate-700">Display name<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className="rounded-xl border border-amber-200 bg-white px-3 py-2 font-medium outline-none focus:border-amber-400" /></label><label className="grid gap-2 text-sm font-black text-slate-700">Username<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="rounded-xl border border-amber-200 bg-white px-3 py-2 font-medium outline-none focus:border-amber-400" /></label></div>
        <label className="grid gap-2 text-sm font-black text-slate-700">Bio<textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={4} className="resize-none rounded-xl border border-amber-200 bg-white px-3 py-2 font-medium leading-6 outline-none focus:border-amber-400" /></label>
        <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-black text-slate-700">Perspective marker<select value={form.perspectiveMarker} onChange={(event) => setForm({ ...form, perspectiveMarker: event.target.value })} className="rounded-xl border border-amber-200 bg-white px-3 py-2 font-medium outline-none focus:border-amber-400">{PERSPECTIVE_MARKERS.map((marker) => <option key={marker || "blank"} value={marker}>{marker || "None"}</option>)}</select></label><label className="grid gap-2 text-sm font-black text-slate-700">Avatar URL<input value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} placeholder="https://..." className="rounded-xl border border-amber-200 bg-white px-3 py-2 font-medium outline-none focus:border-amber-400" /></label></div>
        <div className="grid gap-4 md:grid-cols-3"><label className="grid gap-2 text-sm font-black text-slate-700 md:col-span-1">Website URL<input value={form.creatorWebsiteUrl} onChange={(event) => setForm({ ...form, creatorWebsiteUrl: event.target.value })} placeholder="https://..." className="rounded-xl border border-amber-200 bg-white px-3 py-2 font-medium outline-none focus:border-amber-400" /></label><label className="grid gap-2 text-sm font-black text-slate-700 md:col-span-1">Support URL<input value={form.creatorSupportUrl} onChange={(event) => setForm({ ...form, creatorSupportUrl: event.target.value })} placeholder="https://..." className="rounded-xl border border-amber-200 bg-white px-3 py-2 font-medium outline-none focus:border-amber-400" /></label><label className="grid gap-2 text-sm font-black text-slate-700 md:col-span-1">Support label<input value={form.creatorSupportLabel} onChange={(event) => setForm({ ...form, creatorSupportLabel: event.target.value })} placeholder="Support" className="rounded-xl border border-amber-200 bg-white px-3 py-2 font-medium outline-none focus:border-amber-400" /></label></div>
        <div className="flex justify-end"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:opacity-60">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? "Saving..." : "Save profile"}</button></div>
      </form>
    </section>
  );
}

function FeaturedDiscussions({ discussions, profile }: { discussions: DiscussionRow[]; profile: ProfileRow | null }) {
  return <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[1.5rem] sm:p-5"><div className="mb-3 flex items-center justify-between gap-3 sm:mb-4"><h2 className="font-black text-slate-950">Latest Discussions</h2><Link href="/v2/my-discussions" className="text-sm font-black text-amber-800">View all</Link></div><div className="space-y-3 sm:space-y-4">{discussions.length === 0 ? <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-600 sm:p-5">No discussions yet. Published discussions will appear here.</div> : discussions.map((discussion) => <article key={discussion.id} className="flex gap-3 rounded-2xl border border-slate-100 p-3 sm:gap-4"><CompactProfileAvatar profile={profile} className="size-10 sm:size-12" /><div className="min-w-0"><Link href={`/v2/discussions/${discussion.id}`} className="line-clamp-2 text-sm font-black text-slate-950 hover:text-amber-800 sm:text-base">{discussion.title}</Link><div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2"><span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-800 ring-1 ring-amber-200">{discussion.topic || "Discussion"}</span><span className="rounded-full bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-600">{formatRelativeTime(discussion.created_at)}</span></div><p className="mt-2 text-sm leading-5 text-slate-600 sm:leading-6">{truncate(stripHtml(discussion.body) || "Discussion preview will appear here.", 110)}</p></div></article>)}</div></section>;
}

function RecentReplies({ replies, profile }: { replies: ReplyCard[]; profile: ProfileRow | null }) {
  return <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[1.5rem] sm:p-5"><div className="mb-3 flex items-center justify-between gap-3 sm:mb-4"><h2 className="font-black text-slate-950">Recent Replies</h2><Link href="/v2/my-replies" className="text-sm font-black text-amber-800">View all</Link></div><div className="space-y-3">{replies.length === 0 ? <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-600 sm:p-5">No replies yet. Replies you post across Loombus will appear here.</div> : replies.map((reply) => <Link key={reply.id} href={`/v2/discussions/${reply.discussion_id}`} className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3 transition hover:border-amber-200 hover:bg-amber-50/30"><CompactProfileAvatar profile={profile} className="size-9 sm:size-10" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-950">{reply.discussionTitle}</p><p className="mt-1 text-xs font-semibold text-slate-500">{reply.discussionTopic || "Discussion"} · {formatRelativeTime(reply.created_at)}</p><p className="mt-1 text-sm leading-5 text-slate-600">{truncate(stripHtml(reply.body) || "Reply preview will appear here.", 90)}</p></div><span className="mt-2 size-2 rounded-full bg-amber-600" /></Link>)}</div></section>;
}

function RightRail({ profile, stats, topics }: { profile: ProfileRow | null; stats: ProfileStats; topics: string[] }) {
  const websiteUrl = profile?.creator_website_url?.trim();
  const supportUrl = profile?.creator_support_url?.trim();
  return <aside className="space-y-3 sm:space-y-4"><section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[1.5rem] sm:p-5"><h2 className="mb-3 font-black text-slate-950 sm:mb-4">Known For</h2><div className="space-y-3 sm:space-y-4">{[{ title: topics[0] ?? "Discussion Builder", meta: `${formatCount(stats.discussions)} published discussions`, icon: Award }, { title: topics[1] ?? "Constructive Replies", meta: `${formatCount(stats.replies)} replies across Loombus`, icon: MessageCircle }, { title: topics[2] ?? "Signal Contributor", meta: `${formatCount(stats.signals)} total visible signals`, icon: ShieldCheck }].map((item) => { const Icon = item.icon; return <div key={item.title} className="flex gap-3"><Icon className="mt-1 size-4 shrink-0 text-amber-700 sm:size-5" /><div><p className="text-sm font-black text-slate-950">{item.title}</p><p className="text-xs font-semibold leading-5 text-slate-500">{item.meta}</p></div></div>; })}</div></section><section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[1.5rem] sm:p-5"><div className="mb-3 flex items-center justify-between gap-3 sm:mb-4"><h2 className="font-black text-slate-950">Privacy & Visibility</h2><Link href="/v2/privacy-security" className="text-sm font-black text-amber-800">Manage</Link></div><div className="space-y-2.5 text-sm font-semibold text-slate-600 sm:space-y-3"><div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><Eye className="size-4" />Profile Visibility</span><span>Public</span></div><div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><Globe2 className="size-4" />Activity Visibility</span><span>Public</span></div><div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><Bookmark className="size-4" />Saved Items</span><span>Private</span></div></div>{(websiteUrl || supportUrl) && <div className="mt-4 border-t border-slate-100 pt-4">{websiteUrl && <Link href={websiteUrl} target="_blank" className="mb-2 block text-sm font-black text-amber-800">Creator website</Link>}{supportUrl && <Link href={supportUrl} target="_blank" className="block text-sm font-black text-amber-800">{profile?.creator_support_label?.trim() || "Support"}</Link>}</div>}</section></aside>;
}

export default function V2ProfilePage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("Overview");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileFormState>(profileToForm(null));

  async function loadPage() {
    setLoading(true);
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
      if (!isV2Allowed(nextPayload)) return;
      const currentViewerId = sessionData.session?.user.id ?? null;
      if (!currentViewerId) return;
      setViewerId(currentViewerId);
      const nextProfileData = await loadProfileData(currentViewerId);
      setProfileData(nextProfileData);
      setForm(profileToForm(nextProfileData.profile));
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to load the V2 profile safely. Current Loombus remains available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPage(); const { data } = supabase.auth.onAuthStateChange(() => { void loadPage(); }); return () => data.subscription.unsubscribe(); }, []);

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewerId || saving) return;
    setMessage("");
    if (!form.fullName.trim() || !form.username.trim()) { setMessage("Display name and username are required for a public profile."); return; }
    if (!isValidOptionalUrl(form.avatarUrl) || !isValidOptionalUrl(form.creatorWebsiteUrl) || !isValidOptionalUrl(form.creatorSupportUrl)) { setMessage("Profile links must start with http:// or https://."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: form.fullName.trim(), username: form.username.trim(), bio: form.bio.trim(), perspective_marker: form.perspectiveMarker || null, avatar_url: form.avatarUrl.trim() || null, creator_website_url: form.creatorWebsiteUrl.trim() || null, creator_support_url: form.creatorSupportUrl.trim() || null, creator_support_label: form.creatorSupportLabel.trim() || null }).eq("id", viewerId);
      if (error) { setMessage(error.message || "Unable to save profile."); return; }
      const nextProfileData = await loadProfileData(viewerId);
      setProfileData(nextProfileData);
      setForm(profileToForm(nextProfileData.profile));
      setEditing(false);
      setMessage("Profile updated.");
    } catch { setMessage("Unable to save profile."); } finally { setSaving(false); }
  }

  const data = useMemo<ProfileData>(() => profileData ?? { profile: null, stats: DEFAULT_STATS, discussions: [], replies: [], topics: [] }, [profileData]);
  const visibleDiscussions = activeTab === "Overview" ? data.discussions.slice(0, 4) : data.discussions;
  const visibleReplies = activeTab === "Overview" ? data.replies.slice(0, 4) : data.replies;

  if (loading) return <V2ShellGateCard title="Loading Profile" message="Loombus is verifying access before loading this V2 profile page." loading />;
  if (message && !payload?.authenticated) return <V2ShellGateCard title="V2 profile check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can verify access to the V2 profile page." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on the current experience." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-3 pb-24 pt-4 sm:px-6 sm:pb-28 sm:pt-6 lg:px-8">
        <header className="mb-4 sm:mb-5"><h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Profile</h1><p className="mt-1.5 max-w-2xl text-sm leading-5 text-slate-600 sm:mt-2 sm:leading-6">Your live public profile, contribution overview, and visible Loombus activity.</p></header>
        {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 sm:mb-5">{message}</div>}
        <section className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-4 sm:space-y-6"><ProfileHero profile={data.profile} stats={data.stats} topics={data.topics} onEdit={() => setEditing(true)} />{editing ? <ProfileEditor form={form} setForm={setForm} saving={saving} onSubmit={handleSaveProfile} onCancel={() => { setForm(profileToForm(data.profile)); setEditing(false); }} /> : null}<div className="flex gap-1.5 overflow-x-auto border-b border-slate-200 pb-0 sm:gap-2">{PROFILE_TABS.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-black transition sm:px-4 sm:py-3 ${activeTab === tab ? "border-amber-500 text-amber-800" : "border-transparent text-slate-500 hover:text-amber-800"}`}>{tab}</button>)}</div>{activeTab === "Contributions" ? <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[1.5rem] sm:p-5"><h2 className="font-black text-slate-950">Contribution Overview</h2><div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">{[{ label: "Discussions", value: data.stats.discussions, icon: BookOpen }, { label: "Replies", value: data.stats.replies, icon: Reply }, { label: "Saved", value: data.stats.saved, icon: Bookmark }, { label: "Signals", value: data.stats.signals, icon: Sparkles }].map((item) => { const Icon = item.icon; return <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:p-4"><Icon className="size-4 text-amber-700 sm:size-5" /><p className="mt-2 text-xl font-black text-slate-950 sm:mt-3 sm:text-2xl">{formatCount(item.value)}</p><p className="text-xs font-bold text-slate-500">{item.label}</p></div>; })}</div></section> : <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">{(activeTab === "Overview" || activeTab === "Discussions") && <FeaturedDiscussions discussions={visibleDiscussions} profile={data.profile} />}{(activeTab === "Overview" || activeTab === "Replies") && <RecentReplies replies={visibleReplies} profile={data.profile} />}</div>}</div><RightRail profile={data.profile} stats={data.stats} topics={data.topics} /></section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
