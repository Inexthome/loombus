"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Menu, MessageCircle, Plus, Search, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACCOUNT_NAVIGATION_SECTIONS,
  EXPLORE_NAVIGATION_SECTIONS,
  type LoombusNavigationIcon,
  type LoombusNavigationItem,
} from "@/lib/loombus-navigation";
import { restorePersistedSupabaseSession, supabase } from "@/lib/supabase/client";
import { signOutCurrentDevice } from "@/lib/auth-sign-out";
import {
  Activity, Bookmark, BookOpen, Bot, BriefcaseBusiness, Building2, CalendarDays,
  Clock3, DoorOpen, Home, LayoutDashboard, LifeBuoy, LineChart, LogOut, MapPin,
  Megaphone, Network, Settings, ShieldCheck, ShoppingBag, Sparkles, StickyNote,
  Tags, UserCircle, Users, Wrench,
} from "lucide-react";

type Profile = { username: string | null; full_name: string | null; avatar_url: string | null; is_admin: boolean | null };
type AskProfileResult = { id: string; username: string | null; full_name: string | null; avatar_url: string | null };
type AskDiscussionResult = { id: string; title: string; topic: string };

const icons: Record<LoombusNavigationIcon, LucideIcon> = {
  activity: Activity, appointments: CalendarDays, businesses: Building2, calendar: CalendarDays,
  dashboard: LayoutDashboard, events: CalendarDays, following: Activity, guide: BookOpen,
  history: Clock3, home: Home, jobs: BriefcaseBusiness, labs: Sparkles, local: MapPin,
  marketplace: ShoppingBag, matches: Network, messages: MessageCircle, "my-discussions": MessageCircle,
  "my-replies": MessageCircle, people: Users, premium: Sparkles, privacy: ShieldCheck,
  profile: UserCircle, requests: Megaphone, rooms: DoorOpen, saved: Bookmark, search: Search,
  services: Wrench, settings: Settings, "signal-board": StickyNote, support: LifeBuoy,
  "the-floor": LineChart, topics: Tags, usage: Bot,
};

const ASK_QUICK_LINKS: readonly LoombusNavigationItem[] = [
  { href: "/discussions", label: "Discussions", description: "Browse active conversations.", icon: "my-discussions" },
  { href: "/people", label: "People", description: "Find members and contributors.", icon: "people" },
  { href: "/library", label: "Library", description: "Find books, essays, research, and reports.", icon: "guide" },
  { href: "/the-floor", label: "The Floor", description: "Explore investing theses and research.", icon: "the-floor" },
];

function activePath(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function RailLink({ item, pathname }: { item: LoombusNavigationItem; pathname: string }) {
  const Icon = icons[item.icon];
  const active = activePath(pathname, item.href);
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} data-active={active ? "true" : "false"}>
      <Icon aria-hidden="true" size={18} strokeWidth={2} />
      <span>{item.label}</span>
    </Link>
  );
}

export function DesktopNavigationShell() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [railOpen, setRailOpen] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askQuery, setAskQuery] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askProfiles, setAskProfiles] = useState<AskProfileResult[]>([]);
  const [askDiscussions, setAskDiscussions] = useState<AskDiscussionResult[]>([]);
  const askRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try { setRailOpen(window.localStorage.getItem("loombus:desktop-rail-open") !== "false"); } catch {}
  }, []);

  useEffect(() => {
    document.body.dataset.loombusDesktopRail = railOpen ? "open" : "closed";
    try { window.localStorage.setItem("loombus:desktop-rail-open", railOpen ? "true" : "false"); } catch {}
    return () => { delete document.body.dataset.loombusDesktopRail; };
  }, [railOpen]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      await restorePersistedSupabaseSession();
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const user = data.user ?? null;
      setUserId(user?.id ?? null);
      setEmail(user?.email ?? null);
      if (user?.id) {
        const { data: p } = await supabase.from("profiles").select("username, full_name, avatar_url, is_admin").eq("id", user.id).maybeSingle();
        if (mounted) setProfile((p ?? null) as Profile | null);
      }
    }
    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    setAccountOpen(false);
    setAskOpen(false);
    setAskQuery("");
    setRailOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!askRef.current?.contains(target as Node)) setAskOpen(false);

      if (railOpen) {
        const rail = document.querySelector<HTMLElement>(".loombus-desktop-left-rail");
        const toggle = target?.closest(".loombus-desktop-rail-toggle, .loombus-desktop-rail-collapsed-toggle");
        if (!rail?.contains(target as Node) && !toggle) setRailOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAskOpen(false);
        if (railOpen) setRailOpen(false);
      }
    }
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [railOpen]);

  useEffect(() => {
    const cleanQuery = askQuery.trim().replace(/[,%()]/g, "");
    if (cleanQuery.length < 2) {
      setAskProfiles([]);
      setAskDiscussions([]);
      setAskLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setAskLoading(true);
      const pattern = `%${cleanQuery}%`;
      const [profilesResult, discussionsResult] = await Promise.all([
        supabase.from("profiles").select("id, username, full_name, avatar_url").or(`username.ilike.${pattern},full_name.ilike.${pattern}`).limit(4),
        supabase.from("discussions").select("id, title, topic").is("deleted_at", null).or(`title.ilike.${pattern},topic.ilike.${pattern}`).order("created_at", { ascending: false }).limit(5),
      ]);
      if (cancelled) return;
      setAskProfiles((profilesResult.data ?? []) as AskProfileResult[]);
      setAskDiscussions((discussionsResult.data ?? []) as AskDiscussionResult[]);
      setAskLoading(false);
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [askQuery]);

  const sections = useMemo(() => EXPLORE_NAVIGATION_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.href !== "/search" && item.href !== "/home" && item.href !== "/rooms"),
  })), []);

  const destinationMatches = useMemo(() => {
    const query = askQuery.trim().toLowerCase();
    if (!query) return ASK_QUICK_LINKS;
    return EXPLORE_NAVIGATION_SECTIONS.flatMap((section) => section.items)
      .filter((item) => item.href !== "/search")
      .filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(query))
      .slice(0, 5);
  }, [askQuery]);

  if (!userId) return null;

  const cleanAskQuery = askQuery.trim();
  const displayName = profile?.full_name?.trim() || profile?.username?.trim() || email?.split("@")[0] || "Loombus member";
  const profileHref = profile?.username ? `/u/${profile.username}` : "/profile";
  const hasLiveResults = askProfiles.length > 0 || askDiscussions.length > 0;

  async function logout() { await signOutCurrentDevice(); window.location.href = "/"; }
  function openFullSearch() {
    setAskOpen(false);
    window.dispatchEvent(new Event("loombus:open-global-search"));
  }
  function submitAskQuery() {
    if (cleanAskQuery.length < 2) return;
    setAskOpen(false);
    window.location.href = `/search?q=${encodeURIComponent(cleanAskQuery)}`;
  }

  return (
    <>
      <header className="loombus-desktop-flat-topbar">
        <div className="loombus-desktop-flat-brand-zone">
          <Link href="/home" className="loombus-desktop-flat-brand" aria-label="Loombus home">
            <img src="/assets/brand/loombus-mark-transparent.png" alt="" />
            <strong>Loombus</strong>
          </Link>
          <button type="button" className="loombus-desktop-rail-toggle" onClick={() => setRailOpen((v) => !v)} aria-label={railOpen ? "Close Explore Loombus" : "Open Explore Loombus"} aria-expanded={railOpen}>
            {railOpen ? <X size={19} /> : <Menu size={20} />}
          </button>
        </div>

        <div className="loombus-desktop-ask-wrap" ref={askRef}>
          <Search aria-hidden="true" size={18} className="loombus-desktop-ask-icon" />
          <input
            className="loombus-desktop-ask"
            type="search"
            value={askQuery}
            onChange={(event) => setAskQuery(event.target.value)}
            onFocus={() => setAskOpen(true)}
            onClick={() => setAskOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && cleanAskQuery.length >= 2) {
                event.preventDefault();
                submitAskQuery();
              }
            }}
            placeholder="Ask Loombus or search everything"
            aria-label="Ask Loombus or search everything"
            aria-expanded={askOpen}
            aria-controls="loombus-desktop-ask-panel"
          />

          {askOpen ? (
            <div id="loombus-desktop-ask-panel" className="loombus-desktop-ask-panel" role="dialog" aria-label="Ask Loombus suggestions and results">
              <div className="loombus-desktop-ask-panel-head">
                <strong>{cleanAskQuery ? "Results" : "Suggestions"}</strong>
                <button type="button" onClick={openFullSearch}>Open full search</button>
              </div>

              {cleanAskQuery.length >= 2 ? (
                <Link
                  href={`/search?q=${encodeURIComponent(cleanAskQuery)}`}
                  className="loombus-desktop-ask-full-row"
                  onClick={() => setAskOpen(false)}
                >
                  <Sparkles aria-hidden="true" size={17} style={{ color: "var(--loombus-gold)" }} />
                  <span>
                    <strong style={{ color: "var(--loombus-gold)" }}>Ask Loombus AI</strong>
                    <small>Use AI with “{cleanAskQuery}”</small>
                  </span>
                </Link>
              ) : null}

              {destinationMatches.length > 0 ? (
                <section className="loombus-desktop-ask-section">
                  <p>{cleanAskQuery ? "Destinations" : "Explore"}</p>
                  {destinationMatches.map((item) => {
                    const Icon = icons[item.icon];
                    return (
                      <Link key={item.href} href={item.href} className="loombus-desktop-ask-row">
                        <Icon aria-hidden="true" size={17} strokeWidth={2} />
                        <span><strong>{item.label}</strong><small>{item.description}</small></span>
                      </Link>
                    );
                  })}
                </section>
              ) : null}

              {cleanAskQuery.length >= 2 ? (
                <>
                  {askLoading ? <p className="loombus-desktop-ask-status">Searching Loombus…</p> : null}

                  {askDiscussions.length > 0 ? (
                    <section className="loombus-desktop-ask-section">
                      <p>Discussions</p>
                      {askDiscussions.map((discussion) => (
                        <Link key={discussion.id} href={`/discussions/${discussion.id}`} className="loombus-desktop-ask-row loombus-desktop-ask-row-text">
                          <MessageCircle aria-hidden="true" size={17} strokeWidth={2} />
                          <span><strong>{discussion.title}</strong><small>{discussion.topic || "Discussion"}</small></span>
                        </Link>
                      ))}
                    </section>
                  ) : null}

                  {askProfiles.length > 0 ? (
                    <section className="loombus-desktop-ask-section">
                      <p>People</p>
                      {askProfiles.map((person) => (
                        <Link key={person.id} href={person.username ? `/u/${person.username}` : "/people"} className="loombus-desktop-ask-row">
                          {person.avatar_url ? <img src={person.avatar_url} alt="" /> : <UserCircle aria-hidden="true" size={17} strokeWidth={2} />}
                          <span><strong>{person.full_name?.trim() || person.username || "Loombus member"}</strong><small>{person.username ? `@${person.username}` : "Profile"}</small></span>
                        </Link>
                      ))}
                    </section>
                  ) : null}

                  {!askLoading && !hasLiveResults && destinationMatches.length === 0 ? (
                    <p className="loombus-desktop-ask-status">No quick results. Open full search to search all of Loombus.</p>
                  ) : null}
                </>
              ) : (
                <button type="button" className="loombus-desktop-ask-full-row" onClick={openFullSearch}>
                  <Search aria-hidden="true" size={17} />
                  <span><strong>Search everything</strong><small>Discussions, people, saved items, and Loombus destinations</small></span>
                </button>
              )}
            </div>
          ) : null}
        </div>

        <div className="loombus-desktop-flat-actions">
          <Link href="/create" className="loombus-desktop-create"><Plus size={19} aria-hidden="true" /><span>Create</span></Link>
          <Link href="/messages" className="loombus-desktop-icon-action" aria-label="Messages"><MessageCircle size={19} aria-hidden="true" /></Link>
          <Link href="/notifications" className="loombus-desktop-icon-action" aria-label="Notifications"><Bell size={19} aria-hidden="true" /></Link>
          <div className="loombus-desktop-account-wrap">
            <button type="button" className="loombus-desktop-avatar" onClick={() => setAccountOpen((v) => !v)} aria-label="Open account menu" aria-expanded={accountOpen}>
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{displayName.charAt(0).toUpperCase()}</span>}
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {accountOpen ? (
              <div className="loombus-desktop-account-menu">
                <div className="loombus-desktop-account-id"><strong>{displayName}</strong><span>{profile?.username ? `@${profile.username}` : email}</span></div>
                <Link href={profileHref}><UserCircle size={17} />Profile</Link>
                {ACCOUNT_NAVIGATION_SECTIONS.flatMap((section) => section.items).map((item) => {
                  const Icon = icons[item.icon];
                  return <Link key={item.href} href={item.href}><Icon size={17} />{item.label}</Link>;
                })}
                {profile?.is_admin ? <Link href="/admin"><ShieldCheck size={17} />Admin</Link> : null}
                <button type="button" onClick={logout}><LogOut size={17} />Logout</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <aside className="loombus-desktop-left-rail" data-open={railOpen ? "true" : "false"} aria-label="Explore Loombus">
        <div className="loombus-desktop-left-rail-scroll">
          <nav className="loombus-desktop-rail-primary" aria-label="Primary">
            <RailLink item={{ href: "/home", label: "Home", description: "", icon: "home" }} pathname={pathname} />
            <RailLink item={{ href: "/discussions", label: "Discussions", description: "", icon: "my-discussions" }} pathname={pathname} />
            <RailLink item={{ href: "/rooms", label: "Rooms", description: "", icon: "rooms" }} pathname={pathname} />
          </nav>
          {sections.map((section) => (
            <section key={section.title} className="loombus-desktop-rail-section">
              <h2>{section.title}</h2>
              <nav aria-label={section.title}>{section.items.map((item) => <RailLink key={item.href} item={item} pathname={pathname} />)}</nav>
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}