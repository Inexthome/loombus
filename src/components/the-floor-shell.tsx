"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, BookOpen, Building2, CalendarDays, ChevronRight, LayoutDashboard, Search, Users } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

type MarketData = { generatedAt?: string; markets?: Array<{ key: string; name: string; price: number | null; percentChange: number | null; available: boolean }> };

const desks = [
  { href: "/the-floor", label: "Market Desk", icon: BarChart3 },
  { href: "/the-floor/intelligence", label: "Markets", icon: LayoutDashboard },
  { href: "/the-floor/companies", label: "Companies", icon: Building2 },
  { href: "/the-floor/earnings", label: "Earnings", icon: CalendarDays },
  { href: "/the-floor/my-theses", label: "My Theses", icon: BookOpen },
  { href: "/the-floor/rooms", label: "Rooms", icon: Users },
  { href: "/the-floor/network", label: "Network", icon: Bell },
];

function marketState(now: Date) {
  const values = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const day = values.find((part) => part.type === "weekday")?.value ?? "";
  const minutes = Number(values.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(values.find((part) => part.type === "minute")?.value ?? 0);
  const weekday = !["Sat", "Sun"].includes(day);
  if (weekday && minutes >= 570 && minutes < 960) return { label: "Market open", tone: "bg-emerald-400" };
  if (weekday && minutes >= 240 && minutes < 570) return { label: "Pre-market", tone: "bg-amber-400" };
  if (weekday && minutes >= 960 && minutes < 1200) return { label: "After hours", tone: "bg-sky-400" };
  return { label: "Market closed", tone: "bg-zinc-500" };
}

export default function TheFloorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [marketData, setMarketData] = useState<MarketData | null>(null);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 60_000);
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/floor/market");
        if (response.ok && active) setMarketData((await response.json()) as MarketData);
      } catch {}
    }
    void load();
    const refresh = window.setInterval(load, 300_000);
    return () => { active = false; window.clearInterval(clock); window.clearInterval(refresh); };
  }, []);

  const state = marketState(now);
  const tape = useMemo(() => marketData?.markets?.filter((item) => item.available).slice(0, 6) ?? [], [marketData]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ticker = query.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12);
    if (ticker) router.push(`/the-floor/company/${encodeURIComponent(ticker)}`);
  }

  return (
    <div data-floor-shell className="min-h-screen bg-[#070809] text-[#f4f1e8] [--loombus-page-bg:#070809] [--loombus-surface:#101214] [--loombus-surface-strong:#171a1d] [--loombus-surface-muted:#1c2024] [--loombus-border:#292d31] [--loombus-border-muted:#202428] [--loombus-text:#f4f1e8] [--loombus-text-strong:#ffffff] [--loombus-text-muted:#a7adb4] [--loombus-text-subtle:#747b83] [--loombus-gold:#d6b866] [--loombus-gold-surface:#241f13]">
      <header className="sticky top-0 z-40 border-b border-[#2a2d30] bg-[#090a0b]/95 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="border-b border-[#24272a] bg-[#0d0f10]">
          <div className="mx-auto flex min-h-9 max-w-[1500px] items-center gap-4 overflow-x-auto px-4 text-[11px] font-bold sm:px-6">
            <span className="flex shrink-0 items-center gap-2 uppercase tracking-[0.12em]"><span className={`size-2 rounded-full ${state.tone}`} />{state.label}</span>
            <span className="shrink-0 text-[#737a81]">{now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })} ET</span>
            <span className="h-4 w-px shrink-0 bg-[#34383c]" />
            {tape.length ? tape.map((item) => <span key={item.key} className="flex shrink-0 items-center gap-2 font-mono"><b className="text-[#d6b866]">{item.key}</b><span>{item.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>{item.percentChange !== null ? <span className={item.percentChange >= 0 ? "text-emerald-400" : "text-rose-400"}>{item.percentChange >= 0 ? "+" : ""}{item.percentChange.toFixed(2)}%</span> : null}</span>) : <span className="text-[#737a81]">Market data connecting</span>}
            <span className="ml-auto shrink-0 text-[#737a81]">Delayed / cached</span>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/the-floor" className="flex shrink-0 items-center gap-3" aria-label="The Floor Market Desk">
            <span className="grid size-9 place-items-center rounded-lg border border-[#735f2d] bg-[#201b10] text-sm font-black text-[#d6b866]">F</span>
            <span><span className="block text-sm font-black tracking-wide">THE FLOOR</span><span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-[#858b91]">Market intelligence</span></span>
          </Link>
          <form onSubmit={search} className="mx-auto w-full max-w-xl">
            <label className="flex h-10 items-center gap-3 rounded-lg border border-[#34383c] bg-[#111315] px-3 focus-within:border-[#a98b43]">
              <Search className="size-4 text-[#747b83]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent font-mono text-sm font-bold uppercase outline-none placeholder:font-sans placeholder:font-medium placeholder:normal-case placeholder:text-[#626970]" placeholder="Search ticker or company" aria-label="Search ticker or company" />
              <span className="hidden rounded border border-[#34383c] px-1.5 py-0.5 text-[9px] font-black text-[#737a81] sm:inline">ENTER</span>
            </label>
          </form>
          <Link href="/the-floor/workspace" className="ml-auto hidden shrink-0 items-center gap-2 rounded-lg bg-[#d6b866] px-4 py-2.5 text-xs font-black text-[#111] sm:inline-flex">Open workspace <ChevronRight className="size-3.5" /></Link>
        </div>

        <nav aria-label="The Floor desks" className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-4 sm:px-6">
          {desks.map((item) => { const Icon = item.icon; const active = item.href === "/the-floor" ? pathname === item.href : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className={`flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-black transition ${active ? "border-[#d6b866] text-[#f1d98f]" : "border-transparent text-[#8f969d] hover:text-white"}`}><Icon className="size-3.5" />{item.label}</Link>; })}
        </nav>
      </header>

      {children}

      <footer className="border-t border-[#292d31] bg-[#090a0b] px-4 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#747b83] sm:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-2"><span>Research only · Not investment advice</span><span>Prices may be delayed · Verify before making decisions</span></div>
      </footer>
    </div>
  );
}
