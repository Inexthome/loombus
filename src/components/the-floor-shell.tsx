"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ArrowLeft,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  Compass,
  FileSearch,
  GraduationCap,
  GitFork,
  Globe2,
  House,
  LibraryBig,
  ListChecks,
  Menu,
  MessageSquareText,
  Network,
  Plus,
  Radio,
  ScrollText,
  Search,
  ShieldCheck,
  Settings,
  Trophy,
  UserRoundCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type MarketItem = {
  key: string;
  name: string;
  price: number | null;
  percentChange: number | null;
  available: boolean;
};

type EarningsItem = { symbol: string; name: string; date: string; time: string | null };
type MarketPayload = {
  provider: string;
  delayed: boolean;
  markets: MarketItem[];
  earnings: { available: boolean; events: EarningsItem[] };
};

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const marketNavigation: NavItem[] = [
  { href: "/the-floor", label: "Overview", icon: House, exact: true },
  { href: "/the-floor/intelligence", label: "Market Intelligence", icon: Globe2 },
  { href: "/the-floor/companies", label: "Companies", icon: Building2 },
  { href: "/the-floor/earnings", label: "Earnings", icon: CalendarDays },
  { href: "/the-floor/my-theses", label: "My Theses", icon: ListChecks },
  { href: "/the-floor/rooms", label: "Research Rooms", icon: Users },
  { href: "/the-floor/analysts", label: "Analysts", icon: UserRoundCheck },
  { href: "/the-floor/network", label: "Network Center", icon: Network },
  { href: "/the-floor/live", label: "Live Programming", icon: Radio },
];

const researchNavigation: NavItem[] = [
  { href: "/the-floor/dashboard", label: "Research Dashboard", icon: BarChart3 },
  { href: "/the-floor/hub", label: "Research Hub", icon: LibraryBig },
  { href: "/the-floor/research-desk", label: "Research Desk", icon: FileSearch },
  { href: "/the-floor/workspace", label: "Workspace", icon: ScrollText },
  { href: "/the-floor/research-assistant", label: "AI Assistant", icon: BookOpen },
  { href: "/the-floor/discover", label: "Discover", icon: Compass },
  { href: "/the-floor/knowledge-graph", label: "Knowledge Graph", icon: GitFork },
  { href: "/the-floor/portfolio", label: "Portfolio Intelligence", icon: ShieldCheck },
  { href: "/the-floor/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/the-floor/discussion", label: "Discussion", icon: MessageSquareText },
  { href: "/the-floor/academy", label: "Academy", icon: GraduationCap },
  { href: "/the-floor/contributors", label: "Contributors", icon: UserRoundCheck },
  { href: "/the-floor/settings", label: "Settings", icon: Settings },
];

const routeNames = [...marketNavigation, ...researchNavigation].sort(
  (a, b) => b.href.length - a.href.length
);

function isActive(pathname: string, item: NavItem) {
  if (item.href === "/the-floor/companies" && pathname.startsWith("/the-floor/company/")) return true;
  if (item.href === "/the-floor/analysts" && pathname.startsWith("/the-floor/analyst/")) return true;
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function currentTitle(pathname: string) {
  if (pathname.startsWith("/the-floor/company/")) return "Company Intelligence";
  if (pathname.startsWith("/the-floor/analyst/")) return "Analyst Profile";
  return routeNames.find((item) => isActive(pathname, item))?.label ?? "The Floor";
}

function marketState(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const total = hour * 60 + minute;
  if (["Sat", "Sun"].includes(weekday)) return { label: "Market closed", live: false };
  if (total >= 570 && total < 960) return { label: "Market open", live: true };
  if (total >= 240 && total < 570) return { label: "Pre-market", live: false };
  if (total >= 960 && total < 1200) return { label: "After hours", live: false };
  return { label: "Market closed", live: false };
}

function FloorNavSection({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate: () => void }) {
  return (
    <nav className="floor-terminal-nav" aria-label="The Floor navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} data-active={active ? "true" : "false"} onClick={onNavigate}>
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
            {active ? <ChevronRight className="floor-terminal-nav-arrow" aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export default function TheFloorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [market, setMarket] = useState<MarketPayload | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [memberName, setMemberName] = useState("Member");
  const [accessReady, setAccessReady] = useState(pathname === "/the-floor/subscribe");

  useEffect(() => {
    let mounted = true;
    async function verifyFloorAccess() {
      if (pathname === "/the-floor/subscribe") {
        if (mounted) setAccessReady(true);
        return;
      }
      setAccessReady(false);
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        window.location.replace("/the-floor/subscribe?access=subscribe");
        return;
      }
      const [profileResult, subscriptionResult] = await Promise.all([
        supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
        supabase.from("floor_subscriptions").select("status").eq("user_id", user.id).in("status", ["active", "trialing"]).maybeSingle(),
      ]);
      if (!mounted) return;
      if (profileResult.data?.is_admin === true || subscriptionResult.data) {
        setAccessReady(true);
        return;
      }
      window.location.replace("/the-floor/subscribe?access=subscribe");
    }
    void verifyFloorAccess();
    return () => { mounted = false; };
  }, [pathname]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [marketResponse, auth] = await Promise.all([
        fetch("/api/floor/market", { cache: "no-store" }).catch(() => null),
        supabase.auth.getUser(),
      ]);
      if (!mounted) return;
      if (marketResponse?.ok) setMarket((await marketResponse.json()) as MarketPayload);
      const user = auth.data.user;
      if (user) {
        const { data } = await supabase.from("profiles").select("full_name, username").eq("id", user.id).maybeSingle();
        if (mounted) setMemberName(data?.full_name?.trim()?.split(/\s+/)[0] || data?.username || "Member");
      }
    }
    void load();
    const marketTimer = window.setInterval(load, 300_000);
    const clockTimer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      mounted = false;
      window.clearInterval(marketTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const state = useMemo(() => marketState(now), [now]);
  const tickerItems = market?.markets.filter((item) => item.available).slice(0, 5) ?? [];
  const closeSidebar = () => setSidebarOpen(false);
  const openThesisComposer = () => {
    if (pathname === "/the-floor") window.dispatchEvent(new Event("loombus:floor-open-thesis-composer"));
  };

  if (pathname === "/the-floor/subscribe") return <>{children}</>;
  if (!accessReady) return <main className="floor-access-check">Checking Floor membership…</main>;

  return (
    <div className="floor-terminal-shell" data-floor-route={pathname}>
      <header className="floor-terminal-tape">
        <div className="floor-terminal-state" data-live={state.live ? "true" : "false"}>
          <span aria-hidden="true" /> {state.label}
        </div>
        <p>As of {now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })} ET · Delayed market data</p>
        <div className="floor-terminal-tickers" aria-label="Market ticker">
          {tickerItems.length ? tickerItems.map((item) => (
            <span key={item.key}><b>{item.key}</b> {item.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })} <i data-up={(item.percentChange ?? 0) >= 0 ? "true" : "false"}>{(item.percentChange ?? 0) >= 0 ? "+" : ""}{item.percentChange?.toFixed(2)}%</i></span>
          )) : <span><b>MARKET DATA</b> Connecting…</span>}
        </div>
        <p className="floor-terminal-disclaimer">Research only · Not investment advice</p>
      </header>

      <div className="floor-terminal-grid">
        <aside className="floor-terminal-sidebar" data-open={sidebarOpen ? "true" : "false"}>
          <div className="floor-terminal-brand">
            <Link href="/the-floor" className="floor-terminal-brand-identity" aria-label="The Floor overview">
              <span><Image src="/assets/brand/loombus-mark-transparent.png" alt="" width={44} height={44} priority /></span>
              <span><strong>Loombus</strong><small>The Floor</small></span>
            </Link>
            <Link href="/home" className="floor-terminal-back"><ArrowLeft aria-hidden="true" /> Back to Loombus</Link>
            <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Close Floor navigation"><X /></button>
          </div>
          <Link className="floor-terminal-identity" href="/the-floor" onClick={closeSidebar}>
            <span>The Floor</span>
            <small>Research the market. Test the thesis.</small>
          </Link>

          <p className="floor-terminal-nav-label">Market</p>
          <FloorNavSection items={marketNavigation} pathname={pathname} onNavigate={closeSidebar} />
          <p className="floor-terminal-nav-label">Research tools</p>
          <FloorNavSection items={researchNavigation} pathname={pathname} onNavigate={closeSidebar} />

          <div className="floor-terminal-sidebar-actions">
            <Link href="/search"><Search /> Search Loombus</Link>
            <Link href="/notifications"><Bell /> Notifications</Link>
          </div>
          <div className="floor-terminal-member"><span>{memberName.slice(0, 2).toUpperCase()}</span><div><strong>{memberName}</strong><small>Floor member</small></div></div>
        </aside>

        {sidebarOpen ? <button className="floor-terminal-scrim" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} /> : null}

        <main className="floor-terminal-main">
          <div className="floor-terminal-mobile-head">
            <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open Floor navigation"><Menu /></button>
            <div><span>The Floor</span><strong>{currentTitle(pathname)}</strong></div>
            <Link href="/the-floor?compose=1" aria-label="Post a thesis" onClick={openThesisComposer}><Plus /></Link>
          </div>
          <header className="floor-terminal-context">
            <div><span>The Floor</span><strong>{currentTitle(pathname)}</strong></div>
            <Link href="/the-floor?compose=1" onClick={openThesisComposer}><Plus /> Post a thesis</Link>
          </header>
          <div className="floor-terminal-content">{children}</div>
        </main>

        <aside className="floor-terminal-rail">
          <section>
            <div className="floor-terminal-rail-title"><span>Market watch</span><Link href="/the-floor/intelligence">View all</Link></div>
            <div className="floor-terminal-watchlist">
              {tickerItems.length ? tickerItems.map((item) => (
                <Link key={item.key} href={`/the-floor/company/${encodeURIComponent(item.key)}`}>
                  <span><b>{item.key}</b><small>{item.name}</small></span>
                  <strong>{item.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                  <i data-up={(item.percentChange ?? 0) >= 0 ? "true" : "false"}>{(item.percentChange ?? 0) >= 0 ? "+" : ""}{item.percentChange?.toFixed(2)}%</i>
                </Link>
              )) : <p>Market data is connecting.</p>}
            </div>
          </section>
          <section>
            <div className="floor-terminal-rail-title"><span>Upcoming earnings</span><Link href="/the-floor/earnings">View all</Link></div>
            <div className="floor-terminal-earnings">
              {market?.earnings.available && market.earnings.events.length ? market.earnings.events.slice(0, 5).map((event) => (
                <Link key={`${event.symbol}-${event.date}`} href={`/the-floor/company/${encodeURIComponent(event.symbol)}`}><time>{event.date}</time><span><b>{event.symbol}</b><small>{event.name}</small></span><strong>{event.time ?? "TBD"}</strong></Link>
              )) : <p>Earnings data is temporarily unavailable.</p>}
            </div>
          </section>
          <section className="floor-terminal-standard">
            <ShieldCheck />
            <div><strong>The Floor standard</strong><p>Research and accountability tools. No house buy or sell ratings.</p></div>
          </section>
        </aside>
      </div>
    </div>
  );
}
