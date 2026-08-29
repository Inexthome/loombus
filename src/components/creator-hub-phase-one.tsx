"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ExternalLink,
  Globe2,
  Loader2,
  MessageSquareText,
  PackageOpen,
  Save,
  Store,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type CreatorProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  bio: string | null;
  perspective_marker: string | null;
  avatar_url: string | null;
  creator_website_url: string | null;
  creator_support_url: string | null;
  creator_support_label: string | null;
  is_admin: boolean | null;
};

type CreatorMetrics = { discussions: number; followers: number; profileViews: number };
type RecentDiscussion = { id: string; title: string | null; created_at: string | null };
const EMPTY_METRICS: CreatorMetrics = { discussions: 0, followers: 0, profileViews: 0 };

function validOptionalUrl(value: string) {
  const clean = value.trim();
  return !clean || /^https?:\/\//i.test(clean);
}
function metricValue(result: PromiseSettledResult<{ count: number | null }>) {
  return result.status === "fulfilled" ? result.value.count ?? 0 : 0;
}

export function CreatorHubPhaseOne() {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [metrics, setMetrics] = useState<CreatorMetrics>(EMPTY_METRICS);
  const [recentDiscussions, setRecentDiscussions] = useState<RecentDiscussion[]>([]);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [supportUrl, setSupportUrl] = useState("");
  const [supportLabel, setSupportLabel] = useState("");
  const [canUseCreatorTools, setCanUseCreatorTools] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadCreatorHub() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        window.location.href = "/login?next=/profile?section=creator";
        return;
      }
      const [{ data: profileData }, { data: entitlementData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("user_ai_entitlements").select("tier, ai_assisted_enabled, monthly_summary_limit").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      const loadedProfile = (profileData ?? null) as CreatorProfile | null;
      setProfile(loadedProfile);
      setWebsiteUrl(loadedProfile?.creator_website_url ?? "");
      setSupportUrl(loadedProfile?.creator_support_url ?? "");
      setSupportLabel(loadedProfile?.creator_support_label ?? "");
      const entitled = Boolean(loadedProfile?.is_admin) || (entitlementData?.ai_assisted_enabled === true && entitlementData.tier === "premium" && (entitlementData.monthly_summary_limit ?? 0) > 50);
      setCanUseCreatorTools(entitled);
      const [discussionResult, followerResult, viewResult] = await Promise.allSettled([
        supabase.from("discussions").select("id", { count: "exact", head: true }).eq("author_id", user.id).then(({ count }) => ({ count })),
        supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", user.id).then(({ count }) => ({ count })),
        supabase.from("profile_views").select("id", { count: "exact", head: true }).eq("profile_id", user.id).then(({ count }) => ({ count })),
      ]);
      if (!cancelled) setMetrics({ discussions: metricValue(discussionResult), followers: metricValue(followerResult), profileViews: metricValue(viewResult) });
      const { data: discussions } = await supabase.from("discussions").select("id, title, created_at").eq("author_id", user.id).order("created_at", { ascending: false }).limit(5);
      if (!cancelled) {
        setRecentDiscussions((discussions ?? []) as RecentDiscussion[]);
        setLoading(false);
      }
    }
    void loadCreatorHub();
    return () => { cancelled = true; };
  }, []);

  const publicProfilePath = useMemo(() => {
    const username = profile?.username?.trim();
    return username ? `/u/${encodeURIComponent(username)}` : "";
  }, [profile?.username]);

  async function saveCreatorLinks() {
    if (!profile || saving) return;
    const cleanWebsiteUrl = websiteUrl.trim();
    const cleanSupportUrl = supportUrl.trim();
    const cleanSupportLabel = supportLabel.trim();
    if (!canUseCreatorTools) { setMessage("Creator links require Premium Plus access."); return; }
    if (!validOptionalUrl(cleanWebsiteUrl) || !validOptionalUrl(cleanSupportUrl)) { setMessage("Website and support URLs must begin with http:// or https://."); return; }
    setSaving(true);
    setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) { window.location.href = "/login?next=/profile?section=creator"; return; }
    try {
      const response = await fetch("/api/profile/public", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: profile.full_name ?? "", username: profile.username ?? "", bio: profile.bio ?? "", perspectiveMarker: profile.perspective_marker, avatarUrl: profile.avatar_url, creatorWebsiteUrl: cleanWebsiteUrl, creatorSupportUrl: cleanSupportUrl, creatorSupportLabel: cleanSupportLabel }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(result.error ?? "Unable to save creator links."); return; }
      setProfile((current) => current ? { ...current, creator_website_url: cleanWebsiteUrl, creator_support_url: cleanSupportUrl, creator_support_label: cleanSupportLabel } : current);
      setMessage("Creator links saved.");
    } catch {
      setMessage("Unable to save creator links.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="creator-hub-phase-one" aria-busy="true"><div className="creator-hub-loading"><Loader2 className="animate-spin" aria-hidden="true" />Loading Creator Hub…</div></section>;

  const launchCards = [
    { title: "Publish", description: "Create discussions, research questions, debates, and media posts.", href: "/create", action: "Create content", Icon: MessageSquareText },
    { title: "Rooms", description: "Build communities around your work and ideas.", href: "/rooms", action: "Manage Rooms", Icon: Users },
    { title: "Storefront", description: "Manage Marketplace listings and make your offers discoverable.", href: "/marketplace", action: "Open Marketplace", Icon: Store },
    { title: "Services", description: "Publish services people can discover from your public profile.", href: "/services", action: "Manage services", Icon: PackageOpen },
    { title: "Appointments", description: "Manage bookable time and service-based appointments.", href: "/appointments", action: "Open appointments", Icon: CalendarDays },
  ];

  return (
    <section className="creator-hub-phase-one">
      <header className="creator-hub-hero">
        <div>
          <p className="creator-hub-eyebrow">Creator Hub</p>
          <h2>Operate your public work from one place.</h2>
          <p>Publish, build communities, manage your storefront and services, and connect your creator presence across Loombus.</p>
        </div>
        {publicProfilePath ? <Link href={publicProfilePath} target="_blank" className="creator-hub-primary-link">View public profile <ExternalLink aria-hidden="true" /></Link> : <Link href="/profile?section=public" className="creator-hub-primary-link">Complete public profile <ArrowUpRight aria-hidden="true" /></Link>}
      </header>

      <div className="creator-hub-metrics" aria-label="Creator activity overview">
        <article><MessageSquareText aria-hidden="true" /><span>{metrics.discussions}</span><p>Published discussions</p></article>
        <article><Users aria-hidden="true" /><span>{metrics.followers}</span><p>Followers</p></article>
        <article><BarChart3 aria-hidden="true" /><span>{metrics.profileViews}</span><p>Profile views</p></article>
      </div>

      <section className="creator-hub-section">
        <div className="creator-hub-section-heading"><div><p className="creator-hub-eyebrow">Creator operations</p><h3>Build with Loombus</h3></div></div>
        <div className="creator-hub-launch-grid">
          {launchCards.map(({ title, description, href, action, Icon }) => <article key={title}><Icon aria-hidden="true" /><div><h4>{title}</h4><p>{description}</p></div><Link href={href}>{action} <ArrowUpRight aria-hidden="true" /></Link></article>)}
        </div>
      </section>

      <section className="creator-hub-section creator-hub-content-manager">
        <div className="creator-hub-section-heading"><div><p className="creator-hub-eyebrow">Content</p><h3>Recent discussions</h3></div><Link href="/my-discussions">View all</Link></div>
        {recentDiscussions.length ? <div className="creator-hub-discussion-list">{recentDiscussions.map((discussion) => <Link key={discussion.id} href={`/discussions/${discussion.id}`}><span>{discussion.title?.trim() || "Untitled discussion"}</span><small>{discussion.created_at ? new Date(discussion.created_at).toLocaleDateString() : "Published"}</small><ArrowUpRight aria-hidden="true" /></Link>)}</div> : <div className="creator-hub-empty"><MessageSquareText aria-hidden="true" /><p>Your published discussions will appear here.</p><Link href="/create">Create your first discussion <ArrowUpRight aria-hidden="true" /></Link></div>}
      </section>

      <section className="creator-hub-section creator-hub-links-editor">
        <div className="creator-hub-section-heading"><div><p className="creator-hub-eyebrow">Public creator links</p><h3>Website and external support</h3><p>These links appear on your public profile. Payments completed through an external support service remain outside Loombus.</p></div>{!canUseCreatorTools ? <Link href="/premium">Premium Plus</Link> : null}</div>
        <div className="creator-hub-link-fields">
          <label><span><Globe2 aria-hidden="true" /> Creator website URL</span><input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} disabled={!canUseCreatorTools} placeholder="https://example.com" maxLength={240} /></label>
          <label><span><ExternalLink aria-hidden="true" /> External support URL</span><input type="url" value={supportUrl} onChange={(event) => setSupportUrl(event.target.value)} disabled={!canUseCreatorTools} placeholder="https://example.com/support" maxLength={240} /></label>
          <label><span>Support button label</span><input type="text" value={supportLabel} onChange={(event) => setSupportLabel(event.target.value)} disabled={!canUseCreatorTools} placeholder="Support my work" maxLength={40} /></label>
        </div>
        <div className="creator-hub-save-row"><button type="button" onClick={() => void saveCreatorLinks()} disabled={saving || !canUseCreatorTools}>{saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}{saving ? "Saving…" : "Save creator links"}</button>{message ? <p role="status">{message}</p> : null}</div>
      </section>
    </section>
  );
}
