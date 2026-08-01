"use client";

import Link from "next/link";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleDot,
  Radio,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getFloorCompany } from "@/lib/floor-companies";
import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";

type Thesis = {
  id: string;
  author_id: string;
  ticker: string;
  stance: string;
  conviction: number;
  horizon: string;
  thesis: string;
  catalysts: string;
  risks: string;
  created_at: string;
  author: { username: string | null; full_name: string | null } | { username: string | null; full_name: string | null }[] | null;
};

type ResolvedCall = { id: string; outcome: string | null; created_at: string; thesis: { ticker: string } | { ticker: string }[] | null };
type ResearchRoom = { id: string; name: string; focus: string; updated_at: string; floor_room_members?: { user_id: string }[] };
type MarketItem = { key:string; name:string; price:number|null; percentChange:number|null; available:boolean };
type HistorySeries = { key: string; name: string; points: { time: string; close: number; percent: number }[] };
type MarketData = {
  provider: string;
  delayed: boolean;
  markets: MarketItem[];
  history?: HistorySeries[];
  earnings:{ available:boolean; message:string|null; events:Array<{symbol:string;name:string;date:string;time:string|null;epsEstimate:number|null}> };
};

const chartColors: Record<string, string> = { SPX: "#35c96f", IXIC: "#4f8ee8", DJI: "#d3a928", RUT: "#e5e7eb" };

function authorLabel(author: Thesis["author"]) {
  const profile = Array.isArray(author) ? author[0] : author;
  return profile?.full_name?.trim() || profile?.username?.trim() || "Floor member";
}

function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(delta)) return "Recently";
  const minutes = Math.max(1, Math.floor(delta / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function chartPath(points: HistorySeries["points"], min: number, max: number) {
  const range = Math.max(max - min, 0.01);
  return points.map((point, index) => {
    const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
    const y = 92 - ((point.percent - min) / range) * 84;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function stanceTone(stance: string) {
  if (stance === "long") return "bullish";
  if (stance === "short") return "bearish";
  return "neutral";
}

export default function TheFloorOpeningBell() {
  const [now, setNow] = useState(() => new Date());
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [resolvedCalls, setResolvedCalls] = useState<ResolvedCall[]>([]);
  const [rooms, setRooms] = useState<ResearchRoom[]>([]);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [counts, setCounts] = useState({ theses: 0, rooms: 0 });
  const [memberName, setMemberName] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadMarketData() {
      try {
        const response = await fetch("/api/floor/market", { cache: "no-store" });
        if (response.ok && mounted) setMarketData((await response.json()) as MarketData);
      } catch {}
    }
    void loadMarketData();
    const timer = window.setInterval(loadMarketData, 300_000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [thesisResult, callsResult, roomsResult, thesisCount, roomCount, auth] = await Promise.all([
        supabase.from("floor_theses").select("id,author_id,ticker,stance,conviction,horizon,thesis,catalysts,risks,created_at,author:profiles!floor_theses_author_id_fkey(username,full_name)").or("lifecycle_status.is.null,lifecycle_status.eq.active").order("created_at", { ascending: false }).limit(30),
        supabase.from("floor_calls").select("id,outcome,created_at,thesis:floor_theses!floor_calls_thesis_id_fkey(ticker)").eq("status", "resolved").order("created_at", { ascending: false }).limit(8),
        supabase.from("floor_research_rooms").select("id,name,focus,updated_at,floor_room_members(user_id)").order("updated_at", { ascending: false }).limit(8),
        supabase.from("floor_theses").select("id", { count: "exact", head: true }).or("lifecycle_status.is.null,lifecycle_status.neq.deleted"),
        supabase.from("floor_research_rooms").select("id", { count: "exact", head: true }),
        supabase.auth.getUser(),
      ]);
      if (!mounted) return;
      if (thesisResult.data) setTheses(thesisResult.data as unknown as Thesis[]);
      if (callsResult.data) setResolvedCalls(callsResult.data as unknown as ResolvedCall[]);
      if (roomsResult.data) setRooms(roomsResult.data as unknown as ResearchRoom[]);
      setCounts({ theses: thesisCount.count ?? 0, rooms: roomCount.count ?? 0 });
      if (auth.data.user) {
        const { data: profile } = await supabase.from("profiles").select("full_name,username").eq("id", auth.data.user.id).maybeSingle();
        if (mounted) setMemberName(profile?.full_name?.trim()?.split(/\s+/)[0] || profile?.username || "");
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const highConviction = useMemo(() => theses.filter((item) => item.conviction >= 4).slice(0, 5), [theses]);
  const analystCount = useMemo(() => new Set(theses.map((item) => item.author_id)).size, [theses]);
  const history = marketData?.history ?? [];
  const historyValues = history.flatMap((series) => series.points.map((point) => point.percent));
  const chartMin = historyValues.length ? Math.min(...historyValues, -0.1) : -1;
  const chartMax = historyValues.length ? Math.max(...historyValues, 0.1) : 1;

  const sectors = useMemo(() => {
    const groups = new Map<string, Thesis[]>();
    for (const thesis of theses) {
      const sector = getFloorCompany(thesis.ticker).sector ?? "Unclassified";
      groups.set(sector, [...(groups.get(sector) ?? []), thesis]);
    }
    return [...groups.entries()].map(([name, items]) => {
      const score = items.reduce((sum, item) => sum + (item.stance === "long" ? item.conviction : item.stance === "short" ? -item.conviction : 0), 0) / items.length;
      return { name, score, count: items.length };
    }).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [theses]);

  const briefing = [
    theses.length ? `${theses.length} recent theses are available for review.` : "New research will appear as members publish it.",
    highConviction.length ? `${highConviction.length} recent ideas carry conviction of four or higher.` : "No recent high-conviction thesis is published yet.",
    resolvedCalls.length ? `${resolvedCalls.length} recent calls have reached a recorded outcome.` : "Resolved calls will appear as deadlines are reached.",
  ];

  return (
    <section id="opening-bell" className="floor-overview">
      <header className="floor-overview-briefing">
        <div>
          <p>The Floor briefing</p>
          <h1>Good {now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}{memberName ? `, ${memberName}` : ""}</h1>
          <span>Accountable research, observable conviction, and market context in one workspace.</span>
        </div>
        <ul>{briefing.map((item) => <li key={item}><CircleDot />{item}</li>)}</ul>
      </header>

      <section className="floor-overview-chart">
        <div className="floor-overview-section-title"><div><BarChart3 /><span>Market overview</span></div><small>{marketData ? `${marketData.provider} · delayed/cached` : "Connecting to market history"}</small></div>
        {history.length ? (
          <div className="floor-overview-chart-grid">
            <div className="floor-overview-chart-canvas">
              <span className="floor-chart-zero" style={{ top: `${92 - ((0 - chartMin) / Math.max(chartMax - chartMin, .01)) * 84}%` }} />
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Intraday percentage performance for major market proxies">
                {history.map((series) => <path key={series.key} d={chartPath(series.points, chartMin, chartMax)} stroke={chartColors[series.key] ?? "#c9a951"} />)}
              </svg>
              <div><span>{chartMax.toFixed(2)}%</span><span>{chartMin.toFixed(2)}%</span></div>
            </div>
            <div className="floor-overview-chart-legend">
              {history.map((series) => {
                const last = series.points.at(-1);
                return <div key={series.key}><i style={{ background: chartColors[series.key] }} /><span><b>{series.key}</b><small>{series.name}</small></span><strong data-up={(last?.percent ?? 0) >= 0 ? "true" : "false"}>{(last?.percent ?? 0) >= 0 ? "+" : ""}{last?.percent.toFixed(2)}%</strong></div>;
              })}
            </div>
          </div>
        ) : <div className="floor-overview-chart-empty"><BarChart3 /><strong>Intraday history is temporarily unavailable</strong><span>Current delayed quotes remain available in Market Watch and Market Intelligence.</span></div>}
      </section>

      <div className="floor-overview-middle">
        <section className="floor-overview-activity">
          <div className="floor-overview-section-title"><div><Activity /><span>Today on The Floor</span></div><Link href="/the-floor/discussion">View all</Link></div>
          <div>{theses.slice(0, 6).map((item) => <Link key={item.id} href={`/the-floor/company/${encodeURIComponent(item.ticker)}`}><span>{item.ticker}</span><p><b>{authorLabel(item.author)}</b> published a {stanceTone(item.stance)} thesis</p><time>{relativeTime(item.created_at)}</time></Link>)}{!theses.length ? <p className="floor-overview-empty">New research activity will appear here.</p> : null}</div>
        </section>

        <section className="floor-overview-conviction">
          <div className="floor-overview-section-title"><div><Target /><span>Highest conviction theses</span></div><Link href="/the-floor/my-theses">View all</Link></div>
          <div className="floor-overview-thesis-row">
            {highConviction.map((item) => <Link key={item.id} href={`/the-floor/company/${encodeURIComponent(item.ticker)}`} data-tone={stanceTone(item.stance)}>
              <small>{stanceTone(item.stance)}</small><strong>{item.ticker}</strong><span>{getFloorCompany(item.ticker).name}</span><p>{normalizePublicText(item.thesis)}</p><dl><div><dt>Horizon</dt><dd>{item.horizon}</dd></div><div><dt>Conviction</dt><dd>{item.conviction}/5</dd></div></dl><footer>{authorLabel(item.author)} · {relativeTime(item.created_at)}</footer>
            </Link>)}
            {!highConviction.length ? <p className="floor-overview-empty">High-conviction theses will appear here as members publish them.</p> : null}
          </div>
        </section>
      </div>

      <div className="floor-overview-bottom">
        <section className="floor-overview-sectors">
          <div className="floor-overview-section-title"><div><TrendingUp /><span>Sector research pulse</span></div><Link href="/the-floor/intelligence">Open intelligence</Link></div>
          <p className="floor-overview-caption">Research stance and disclosed conviction, not market performance.</p>
          <div>{sectors.map((sector) => <article key={sector.name} data-tone={sector.score > .4 ? "bullish" : sector.score < -.4 ? "bearish" : "neutral"}><span>{sector.name}</span><strong>{sector.score > .4 ? "Bullish" : sector.score < -.4 ? "Bearish" : "Mixed"}</strong><small>{sector.count} {sector.count === 1 ? "thesis" : "theses"}</small></article>)}{!sectors.length ? <p className="floor-overview-empty">Sector coverage will appear as company research is published.</p> : null}</div>
        </section>

        <section className="floor-overview-rooms">
          <div className="floor-overview-section-title"><div><Users /><span>Active research rooms</span></div><Link href="/the-floor/rooms">View all</Link></div>
          <div className="floor-overview-room-table"><header><span>Room</span><span>Focus</span><span>Analysts</span><span>Updated</span></header>{rooms.slice(0, 6).map((room) => <Link key={room.id} href="/the-floor/rooms"><span>{room.name}</span><span>{room.focus || "General research"}</span><strong>{room.floor_room_members?.length ?? 0}</strong><time>{relativeTime(room.updated_at)}</time></Link>)}{!rooms.length ? <p className="floor-overview-empty">Create or join a Research Room to begin.</p> : null}</div>
        </section>
      </div>

      <section className="floor-overview-community">
        <div><Radio /><span>Floor community</span></div>
        <dl><div><dt>Covered analysts</dt><dd>{analystCount}</dd></div><div><dt>Published theses</dt><dd>{counts.theses}</dd></div><div><dt>Research rooms</dt><dd>{counts.rooms}</dd></div><div><dt>Recent outcomes</dt><dd>{resolvedCalls.length}</dd></div></dl>
        <Link href="/the-floor/leaderboard"><CheckCircle2 /> Study track records</Link>
      </section>
    </section>
  );
}
