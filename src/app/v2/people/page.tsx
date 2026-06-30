"use client";

import Link from "next/link";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { BadgeCheck, ChevronRight, MessageCircle, Search, SlidersHorizontal, Users } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../v2-shell-components";

type Profile = { id: string; full_name: string | null; username: string | null; avatar_url: string | null; bio: string | null };
type Counts = Record<string, { followers: number; following: number }>;
type Badge = { key: "premium" | "premium_plus" | "admin"; label: string };
type ViewMode = "all" | "following" | "followers" | "mutual" | "suggested" | "top";
type RelationshipRow = { following_id?: string | null; follower_id?: string | null };
type BlockRow = { blocker_id: string; blocked_id: string };

function nameFor(profile: Profile) { return profile.full_name?.trim() || profile.username?.trim() || "Loombus member"; }
function userFor(profile: Profile) { return profile.username ? `@${profile.username}` : "No username yet"; }
function cleanBio(value: string | null) { return (value ?? "").replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "No bio yet."; }
function hrefFor(profile: Profile) { return profile.username ? `/u/${profile.username}` : "/v2/people"; }
function badgeClass(badge: Badge) { if (badge.key === "admin") return "border-sky-200 bg-sky-50 text-sky-800"; if (badge.key === "premium_plus") return "border-violet-200 bg-violet-50 text-violet-800"; return "border-emerald-200 bg-emerald-50 text-emerald-800"; }
function formatCount(value: number) { if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`; return Math.max(0, value).toLocaleString(); }

export default function V2PeoplePage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followerIds, setFollowerIds] = useState<Set<string>>(new Set());
  const [suggestedIds, setSuggestedIds] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Counts>({});
  const [badges, setBadges] = useState<Record<string, Badge>>({});
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<ViewMode>("all");
  const [query, setQuery] = useState("");
  const [showViews, setShowViews] = useState(false);
  const [loading, setLoading] = useState(true);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [workingFollowId, setWorkingFollowId] = useState<string | null>(null);
  const [workingMessageId, setWorkingMessageId] = useState<string | null>(null);

  async function loadBadges(ids: string[]) {
    if (ids.length === 0) return;
    const response = await fetch("/api/profiles/badges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileIds: ids }) }).catch(() => null);
    if (!response?.ok) return;
    const result = (await response.json().catch(() => ({}))) as { badges?: Record<string, Badge> };
    setBadges(result.badges ?? {});
  }

  async function loadPeople(id: string) {
    setPeopleLoading(true); setMessage("");
    try {
      const [viewerResult, followingResult, followersResult, privacyResult] = await Promise.all([
        supabase.from("profiles").select("is_admin").eq("id", id).maybeSingle(),
        supabase.from("follows").select("following_id").eq("follower_id", id),
        supabase.from("follows").select("follower_id").eq("following_id", id),
        supabase.from("user_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${id},blocked_id.eq.${id}`),
      ]);
      const firstError = viewerResult.error || followingResult.error || followersResult.error || privacyResult.error;
      if (firstError) throw firstError;

      const admin = Boolean((viewerResult.data as { is_admin?: boolean } | null)?.is_admin);
      setIsAdmin(admin);
      const following = ((followingResult.data ?? []) as RelationshipRow[]).map((row) => row.following_id).filter((value): value is string => Boolean(value));
      const followers = ((followersResult.data ?? []) as RelationshipRow[]).map((row) => row.follower_id).filter((value): value is string => Boolean(value));
      setFollowingIds(new Set(following));
      setFollowerIds(new Set(followers));

      const excluded = new Set<string>();
      for (const row of (privacyResult.data ?? []) as BlockRow[]) excluded.add(row.blocker_id === id ? row.blocked_id : row.blocker_id);
      setExcludedIds(admin ? new Set() : excluded);

      const relationshipIds = new Set<string>([...following, ...followers]);
      relationshipIds.delete(id); excluded.forEach((profileId) => relationshipIds.delete(profileId));
      const suggested = new Set<string>();
      if (following.length > 0) {
        const suggestionResult = await supabase.from("follows").select("following_id").in("follower_id", following.filter((profileId) => !excluded.has(profileId))).limit(100);
        if (!suggestionResult.error) ((suggestionResult.data ?? []) as RelationshipRow[]).forEach((row) => { const profileId = row.following_id; if (profileId && profileId !== id && !relationshipIds.has(profileId) && !excluded.has(profileId)) suggested.add(profileId); });
      }

      let visibleIds = Array.from(new Set([...relationshipIds, ...Array.from(suggested).slice(0, 24)]));
      let loaded: Profile[] = [];
      if (admin) {
        const result = await supabase.from("profiles").select("id, full_name, username, avatar_url, bio").order("full_name", { ascending: true });
        if (result.error) throw result.error;
        loaded = (result.data ?? []) as Profile[];
        visibleIds = loaded.map((profile) => profile.id);
      } else if (visibleIds.length > 0) {
        const result = await supabase.from("profiles").select("id, full_name, username, avatar_url, bio").in("id", visibleIds).order("full_name", { ascending: true });
        if (result.error) throw result.error;
        loaded = (result.data ?? []) as Profile[];
      }
      setProfiles(loaded); setSuggestedIds(suggested);

      const nextCounts: Counts = Object.fromEntries(visibleIds.map((profileId) => [profileId, { followers: 0, following: 0 }]));
      if (visibleIds.length > 0) {
        const [followerCountResult, followingCountResult] = await Promise.all([
          supabase.from("follows").select("following_id").in("following_id", visibleIds),
          supabase.from("follows").select("follower_id").in("follower_id", visibleIds),
        ]);
        if (!followerCountResult.error) ((followerCountResult.data ?? []) as RelationshipRow[]).forEach((row) => { if (row.following_id && nextCounts[row.following_id]) nextCounts[row.following_id].followers += 1; });
        if (!followingCountResult.error) ((followingCountResult.data ?? []) as RelationshipRow[]).forEach((row) => { if (row.follower_id && nextCounts[row.follower_id]) nextCounts[row.follower_id].following += 1; });
      }
      setCounts(nextCounts); void loadBadges(visibleIds);
    } catch {
      setProfiles([]); setMessage("People could not load. Please refresh and try again.");
    } finally {
      setPeopleLoading(false);
    }
  }

  async function loadShell() {
    setLoading(true); setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
      const id = data.session?.user.id ?? null;
      setViewerId(id);
      if (id && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") await loadPeople(id);
    } catch {
      setPayload(getDefaultShellPayload()); setMessage("Unable to verify V2 People access. Current Loombus remains on V1.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadShell(); const { data } = supabase.auth.onAuthStateChange(() => void loadShell()); return () => data.subscription.unsubscribe(); }, []);

  const visibleProfiles = useMemo(() => profiles.filter((profile) => isAdmin || !excludedIds.has(profile.id)), [profiles, isAdmin, excludedIds]);
  const topPeople = useMemo(() => [...visibleProfiles].sort((a, b) => (counts[b.id]?.followers ?? 0) - (counts[a.id]?.followers ?? 0)), [visibleProfiles, counts]);
  const suggestedPeople = useMemo(() => visibleProfiles.filter((profile) => suggestedIds.has(profile.id) && !followingIds.has(profile.id)).slice(0, 3), [visibleProfiles, suggestedIds, followingIds]);

  const filteredProfiles = useMemo(() => {
    const search = query.trim().toLowerCase();
    const base = visibleProfiles.filter((profile) => {
      if (view === "following" && !followingIds.has(profile.id)) return false;
      if (view === "followers" && !followerIds.has(profile.id)) return false;
      if (view === "mutual" && !(followingIds.has(profile.id) && followerIds.has(profile.id))) return false;
      if (view === "suggested" && !(isAdmin || suggestedIds.has(profile.id))) return false;
      if (!search) return true;
      return [profile.full_name, profile.username, cleanBio(profile.bio)].some((value) => (value ?? "").toLowerCase().includes(search));
    });
    if (view === "top") return [...base].sort((a, b) => (counts[b.id]?.followers ?? 0) - (counts[a.id]?.followers ?? 0));
    return base;
  }, [visibleProfiles, view, followingIds, followerIds, suggestedIds, query, isAdmin, counts]);

  const mutualCount = visibleProfiles.filter((profile) => followingIds.has(profile.id) && followerIds.has(profile.id)).length;
  const viewLabel = view === "all" ? (isAdmin ? "All people" : "All visible people") : view === "top" ? "Top Contributors" : view === "mutual" ? "Mutual" : view.charAt(0).toUpperCase() + view.slice(1);

  async function startMessage(event: MouseEvent<HTMLButtonElement>, profile: Profile) {
    event.preventDefault(); event.stopPropagation();
    if (!viewerId || profile.id === viewerId || workingMessageId) return;
    setWorkingMessageId(profile.id); setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { window.location.href = "/v2/login"; return; }
      const response = await fetch("/api/messages/conversations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ targetUserId: profile.id }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error ?? "Unable to start message."); setWorkingMessageId(null); return; }
      window.location.href = `/v2/messages?conversation=${encodeURIComponent(result.conversationId)}`;
    } catch { setMessage("Unable to start message."); setWorkingMessageId(null); }
  }

  async function toggleFollow(event: MouseEvent<HTMLButtonElement>, profile: Profile) {
    event.preventDefault(); event.stopPropagation(); setMessage("");
    if (!viewerId) { window.location.href = "/v2/login"; return; }
    if (profile.id === viewerId || workingFollowId) return;
    setWorkingFollowId(profile.id);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { window.location.href = "/v2/login"; return; }
      const response = await fetch("/api/follows/toggle", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ targetUserId: profile.id }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error ?? "Unable to update follow status."); return; }
      setFollowingIds((current) => { const next = new Set(current); if (result.following) next.add(profile.id); else next.delete(profile.id); return next; });
      setCounts((current) => ({ ...current, [profile.id]: { followers: Math.max(0, (current[profile.id]?.followers ?? 0) + (result.following ? 1 : -1)), following: current[profile.id]?.following ?? 0 } }));
      setMessage(result.following ? `Following @${profile.username ?? "member"}.` : `Unfollowed @${profile.username ?? "member"}.`);
    } finally { setWorkingFollowId(null); }
  }

  if (loading) return <V2ShellGateCard title="Checking V2 People access" message="Loombus is verifying access before loading the V2 People shell." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="The V2 People shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 People is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#fbfaf7] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-8">
        <header className="mb-5">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">People</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Find thoughtful contributors, mutual connections, and people shaping useful discussions.</p>
        </header>

        {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{message}</div>}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-5">
            <section className="space-y-4">
              <div className="flex gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <Search className="size-5 text-slate-400" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people, bios, and usernames" className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400" />
                </div>
                <button type="button" onClick={() => setShowViews((open) => !open)} aria-expanded={showViews} className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"><SlidersHorizontal className="size-5" /></button>
              </div>
              <div className={`${showViews ? "flex" : "hidden sm:flex"} gap-2 overflow-x-auto pb-1`}>
                <ViewPill label="All" value="all" />
                <ViewPill label="Following" value="following" />
                <ViewPill label="Followers" value="followers" />
                <ViewPill label="Mutual" value="mutual" />
                <ViewPill label="Suggested" value="suggested" />
                <ViewPill label="Top Contributors" value="top" />
              </div>
            </section>

            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
              {peopleLoading && <div className="p-6 text-sm font-semibold text-slate-500">Loading people...</div>}
              {!peopleLoading && filteredProfiles.length === 0 && <div className="p-6"><h2 className="text-xl font-black text-slate-950">No visible people found.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{isAdmin ? "No people match this platform view." : "No people match this relationship view yet. Follow contributors from discussions to build your network."}</p><Link href="/v2/discussions" className="mt-4 inline-flex rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950">Browse discussions</Link></div>}
              {!peopleLoading && filteredProfiles.map((profile) => <PersonRow key={profile.id} profile={profile} />)}
              {!peopleLoading && filteredProfiles.length > 0 && <div className="border-t border-slate-100 px-5 py-4 text-center text-sm font-black text-amber-800">Showing {filteredProfiles.length} people</div>}
            </section>
          </div>

          <aside className="space-y-4">
            <RailCard title="Suggested people" action="View all" onAction={() => setView("suggested")}>
              {suggestedPeople.length === 0 ? <p className="text-sm font-semibold text-slate-500">No new suggestions yet.</p> : suggestedPeople.map((profile) => <MiniPerson key={profile.id} profile={profile} />)}
            </RailCard>
            <RailCard title="Top contributors" action="View all" onAction={() => setView("top")}>
              {topPeople.slice(0, 5).map((profile, index) => <RankedPerson key={profile.id} profile={profile} rank={index + 1} />)}
            </RailCard>
            <RailCard title="Network summary">
              <div className="grid grid-cols-2 gap-2 text-center"><Stat label="Showing" value={filteredProfiles.length} /><Stat label="Visible" value={visibleProfiles.length} /><Stat label="Following" value={followingIds.size} amber /><Stat label="Mutual" value={mutualCount} amber /></div>
              <p className="mt-4 text-sm leading-6 text-slate-600">Current view: <span className="font-black text-slate-950">{viewLabel}</span></p>
            </RailCard>
          </aside>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );

  function ViewPill({ label, value }: { label: string; value: ViewMode }) { return <button type="button" onClick={() => setView(value)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${view === value ? "bg-amber-300 text-slate-950 shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-amber-50 hover:text-amber-800"}`}>{label}</button>; }
  function RailCard({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) { return <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">{title}</h2>{action && <button type="button" onClick={onAction} className="text-sm font-black text-amber-800 hover:text-amber-900">{action}</button>}</div><div className="space-y-4">{children}</div></section>; }
  function Stat({ label, value, amber = false }: { label: string; value: number; amber?: boolean }) { return <div className={`rounded-2xl p-3 ${amber ? "bg-amber-50" : "bg-slate-50"}`}><p className={`text-xs font-bold ${amber ? "text-amber-800" : "text-slate-500"}`}>{label}</p><p className={`mt-1 text-lg font-black ${amber ? "text-amber-900" : "text-slate-950"}`}>{formatCount(value)}</p></div>; }
  function MiniPerson({ profile }: { profile: Profile }) { const following = followingIds.has(profile.id); return <div className="flex items-center justify-between gap-3"><Link href={hrefFor(profile)} className="flex min-w-0 items-center gap-3"><ProfileAvatar profile={profile} size="md" /><span className="min-w-0"><span className="flex items-center gap-1 truncate text-sm font-black text-slate-800">{nameFor(profile)}<BadgeCheck className="size-3.5 shrink-0 text-amber-700" /></span><span className="block truncate text-xs font-semibold text-slate-500">{cleanBio(profile.bio)}</span></span></Link>{viewerId !== profile.id && <button type="button" onClick={(event) => void toggleFollow(event, profile)} disabled={workingFollowId === profile.id} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 transition hover:bg-amber-100 disabled:opacity-50">{workingFollowId === profile.id ? "..." : following ? "Following" : "Follow"}</button>}</div>; }
  function RankedPerson({ profile, rank }: { profile: Profile; rank: number }) { return <Link href={hrefFor(profile)} className="flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-3"><ProfileAvatar profile={profile} size="sm" /><span className="grid size-6 place-items-center rounded-full bg-amber-100 text-xs font-black text-amber-800">{rank}</span><span className="min-w-0"><span className="block truncate font-black text-slate-800">{nameFor(profile)}</span><span className="block truncate text-xs font-semibold text-slate-400">{formatCount(counts[profile.id]?.followers ?? 0)} followers</span></span></span></Link>; }
  function PersonRow({ profile }: { profile: Profile }) { const self = viewerId === profile.id; const following = followingIds.has(profile.id); const mutual = followingIds.has(profile.id) && followerIds.has(profile.id); const badge = badges[profile.id]; return <article className="border-b border-slate-100 p-5 transition last:border-b-0 hover:bg-amber-50/30"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]"><Link href={hrefFor(profile)} className="flex min-w-0 gap-4"><ProfileAvatar profile={profile} size="xl" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-black tracking-tight text-slate-950 sm:text-xl">{nameFor(profile)}</h2><BadgeCheck className="size-4 shrink-0 text-amber-700" />{mutual && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[0.7rem] font-black text-amber-800">Mutual</span>}{mutual && !self && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-black text-emerald-800">Can message</span>}{suggestedIds.has(profile.id) && !following && !followerIds.has(profile.id) && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[0.7rem] font-black text-amber-800">Suggested</span>}{badge && <span className={`rounded-full border px-2.5 py-1 text-[0.7rem] font-black ${badgeClass(badge)}`}>{badge.label}</span>}</div><p className="mt-1 text-sm font-semibold text-slate-500">{userFor(profile)}</p><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{cleanBio(profile.bio)}</p><p className="mt-3 inline-flex items-center gap-2 text-xs font-black text-amber-800"><MessageCircle className="size-4" /> View profile</p></div></Link><div className="flex flex-col justify-between gap-4 lg:items-end"><div className="space-y-1 text-sm font-semibold text-slate-600 lg:text-right"><p><Users className="mr-1 inline size-4" />{formatCount(counts[profile.id]?.followers ?? 0)} followers</p><p><Users className="mr-1 inline size-4" />{formatCount(counts[profile.id]?.following ?? 0)} following</p></div>{self ? <span className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-black text-slate-500">You</span> : <div className="flex gap-2 lg:flex-col">{mutual && <button type="button" onClick={(event) => void startMessage(event, profile)} disabled={workingMessageId === profile.id} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-black text-slate-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50">{workingMessageId === profile.id ? "Opening..." : "Message"}</button>}<button type="button" onClick={(event) => void toggleFollow(event, profile)} disabled={workingFollowId === profile.id} className={`rounded-xl px-5 py-2 text-center text-sm font-black transition disabled:opacity-50 ${following ? "border border-slate-200 text-slate-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800" : "bg-amber-300 text-slate-950 hover:bg-amber-400"}`}>{workingFollowId === profile.id ? "Updating..." : following ? "Following" : "Follow"}</button></div>}</div></div></article>; }
}
