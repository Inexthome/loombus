"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Menu, MessageCircle, Plus, Search, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => { setAccountOpen(false); }, [pathname]);

  const sections = useMemo(() => EXPLORE_NAVIGATION_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.href !== "/search" && item.href !== "/home" && item.href !== "/rooms"),
  })), []);

  if (!userId) return null;

  const displayName = profile?.full_name?.trim() || profile?.username?.trim() || email?.split("@")[0] || "Loombus member";
  const profileHref = profile?.username ? `/u/${profile.username}` : "/profile";

  async function logout() { await signOutCurrentDevice(); window.location.href = "/"; }

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

        <Link href="/search" className="loombus-desktop-ask" aria-label="Ask Loombus or search everything">
          <Search aria-hidden="true" size={18} />
          <span>Ask Loombus or search everything</span>
        </Link>

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
