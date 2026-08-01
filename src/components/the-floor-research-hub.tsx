"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import {
  FLOOR_JOURNAL_KEY,
  FLOOR_ROOMS_KEY,
  FLOOR_WATCHLIST_KEY,
  FloorJournalEntry,
  FloorRoom,
  FloorWatchItem,
  FloorWatchType,
  makeFloorId,
  normalizeFloorSymbol,
  splitFloorList,
} from "@/lib/floor-research-hub";
import { mergeFloorLocalWithCloud, replaceFloorCloudItems, type FloorCloudKind } from "@/lib/floor-cloud-data";
import { supabase } from "@/lib/supabase/client";
import {
  ArrowLeft,
  BookOpen,
  CheckSquare,
  Eye,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Tab = "watchlists" | "journal" | "rooms";

function readStored<T>(key: string): T[] {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T[]) : [];
  } catch {
    return [];
  }
}

const inputClass =
  "min-h-11 w-full rounded-2xl border border-[var(--loombus-border)] bg-transparent px-3 text-sm outline-none focus:border-[var(--loombus-gold)]";
const areaClass =
  "w-full rounded-2xl border border-[var(--loombus-border)] bg-transparent p-3 text-sm leading-6 outline-none focus:border-[var(--loombus-gold)]";
const cardClass =
  "rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 text-sm font-black text-black";

export default function TheFloorResearchHub() {
  const [loading, setLoading] = useState(true);
  const [ownerId, setOwnerId] = useState("");
  const [cloudStatus, setCloudStatus] = useState<"syncing" | "synced" | "local">("syncing");
  const [tab, setTab] = useState<Tab>("watchlists");
  const [watchItems, setWatchItems] = useState<FloorWatchItem[]>([]);
  const [journal, setJournal] = useState<FloorJournalEntry[]>([]);
  const [rooms, setRooms] = useState<FloorRoom[]>([]);

  const [watchType, setWatchType] = useState<FloorWatchType>("company");
  const [watchLabel, setWatchLabel] = useState("");
  const [watchNote, setWatchNote] = useState("");

  const [ticker, setTicker] = useState("");
  const [journalTitle, setJournalTitle] = useState("");
  const [journalBody, setJournalBody] = useState("");
  const [conviction, setConviction] = useState(50);

  const [roomName, setRoomName] = useState("");
  const [roomFocus, setRoomFocus] = useState("");
  const [roomObjective, setRoomObjective] = useState("");
  const [roomWatchlist, setRoomWatchlist] = useState("");
  const [roomTasks, setRoomTasks] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        window.location.replace("/login?next=%2Fthe-floor%2Fhub");
        return;
      }
      setOwnerId(data.user.id);
      const localWatches = readStored<FloorWatchItem>(FLOOR_WATCHLIST_KEY);
      const localJournal = readStored<FloorJournalEntry>(FLOOR_JOURNAL_KEY);
      setRooms(readStored<FloorRoom>(FLOOR_ROOMS_KEY));
      try {
        const [cloudWatches, cloudJournal] = await Promise.all([
          mergeFloorLocalWithCloud(data.user.id, "watch", localWatches),
          mergeFloorLocalWithCloud(data.user.id, "journal", localJournal),
        ]);
        setWatchItems(cloudWatches);
        setJournal(cloudJournal);
        window.localStorage.setItem(FLOOR_WATCHLIST_KEY, JSON.stringify(cloudWatches));
        window.localStorage.setItem(FLOOR_JOURNAL_KEY, JSON.stringify(cloudJournal));
        setCloudStatus("synced");
      } catch {
        setWatchItems(localWatches);
        setJournal(localJournal);
        setCloudStatus("local");
      }
      setLoading(false);
    })();
  }, []);

  function persist<T extends { id: string }>(key: string, values: T[], setter: (values: T[]) => void) {
    setter(values);
    window.localStorage.setItem(key, JSON.stringify(values));
    const kind: FloorCloudKind | null =
      key === FLOOR_WATCHLIST_KEY ? "watch" : key === FLOOR_JOURNAL_KEY ? "journal" : null;
    if (ownerId && kind) {
      setCloudStatus("syncing");
      void replaceFloorCloudItems(ownerId, kind, values)
        .then(() => setCloudStatus("synced"))
        .catch(() => setCloudStatus("local"));
    }
  }

  function addWatch(event: FormEvent) {
    event.preventDefault();
    const label = watchType === "company" ? normalizeFloorSymbol(watchLabel) : watchLabel.trim();
    if (!label) return;
    const next = [
      { id: makeFloorId("watch"), type: watchType, label, note: watchNote.trim(), createdAt: new Date().toISOString() },
      ...watchItems,
    ];
    persist(FLOOR_WATCHLIST_KEY, next, setWatchItems);
    setWatchLabel("");
    setWatchNote("");
  }

  function addJournalEntry(event: FormEvent) {
    event.preventDefault();
    if (!journalTitle.trim() || !journalBody.trim()) return;
    const next = [
      {
        id: makeFloorId("journal"),
        ticker: normalizeFloorSymbol(ticker),
        title: journalTitle.trim(),
        body: journalBody.trim(),
        conviction,
        createdAt: new Date().toISOString(),
      },
      ...journal,
    ];
    persist(FLOOR_JOURNAL_KEY, next, setJournal);
    setTicker("");
    setJournalTitle("");
    setJournalBody("");
    setConviction(50);
  }

  function createRoom(event: FormEvent) {
    event.preventDefault();
    if (!roomName.trim() || !roomObjective.trim()) return;
    const next = [
      {
        id: makeFloorId("room"),
        name: roomName.trim(),
        focus: roomFocus.trim(),
        objective: roomObjective.trim(),
        watchlist: splitFloorList(roomWatchlist).map(normalizeFloorSymbol).filter(Boolean),
        tasks: splitFloorList(roomTasks),
        createdAt: new Date().toISOString(),
      },
      ...rooms,
    ];
    persist(FLOOR_ROOMS_KEY, next, setRooms);
    setRoomName("");
    setRoomFocus("");
    setRoomObjective("");
    setRoomWatchlist("");
    setRoomTasks("");
  }

  const counts = useMemo(
    () => [
      { label: "Watched signals", value: watchItems.length },
      { label: "Journal entries", value: journal.length },
      { label: "Research rooms", value: rooms.length },
    ],
    [watchItems.length, journal.length, rooms.length],
  );

  if (loading) return <LoombusLoadingScreen title="Opening Research Hub..." message="Loading your private research system." />;

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className={cardClass}>
          <Link href="/the-floor" className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--loombus-text-muted)]">
            <ArrowLeft className="size-3.5" /> Back to The Floor
          </Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Private research operating system</p>
              <div className="mt-1 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black">Research Hub</h1><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${cloudStatus === "synced" ? "bg-emerald-500/15 text-emerald-400" : cloudStatus === "syncing" ? "bg-amber-500/15 text-amber-400" : "bg-[var(--loombus-surface-muted)] text-[var(--loombus-text-muted)]"}`}>{cloudStatus === "synced" ? "Cloud synced" : cloudStatus === "syncing" ? "Syncing" : "Local fallback"}</span></div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                Monitor companies and ideas, preserve your reasoning over time, and organize structured research rooms.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {counts.map((item) => (
                <div key={item.label} className="rounded-2xl bg-[var(--loombus-surface-muted)] px-4 py-3">
                  <p className="text-xl font-black">{item.value}</p>
                  <p className="text-xs font-bold text-[var(--loombus-text-muted)]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto">
            {([
              ["watchlists", "Watchlists", Eye],
              ["journal", "Research Journal", BookOpen],
              ["rooms", "Research Rooms", Users],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-black ${tab === value ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`}
              >
                <Icon className="size-4 text-[var(--loombus-gold)]" /> {label}
              </button>
            ))}
          </div>
        </header>

        {tab === "watchlists" ? (
          <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            <form onSubmit={addWatch} className={cardClass}>
              <h2 className="text-lg font-black">Watch a research signal</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">Watch more than stocks. Track themes, risks, analysts, and catalysts.</p>
              <div className="mt-4 space-y-3">
                <select value={watchType} onChange={(event) => setWatchType(event.target.value as FloorWatchType)} className={inputClass}>
                  <option value="company">Company</option>
                  <option value="theme">Theme</option>
                  <option value="risk">Risk</option>
                  <option value="analyst">Analyst</option>
                  <option value="catalyst">Catalyst</option>
                </select>
                <input value={watchLabel} onChange={(event) => setWatchLabel(event.target.value)} className={inputClass} placeholder={watchType === "company" ? "Ticker, for example NVDA" : "Name"} />
                <textarea value={watchNote} onChange={(event) => setWatchNote(event.target.value)} className={areaClass} rows={4} placeholder="Why are you watching this?" />
                <button className={buttonClass}><Plus className="size-4" /> Add to watchlist</button>
              </div>
            </form>
            <section className={cardClass}>
              <h2 className="text-lg font-black">My monitored universe</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {watchItems.length ? watchItems.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-[var(--loombus-border)] p-4">
                    <div className="flex justify-between gap-3">
                      <div><p className="text-[10px] font-black uppercase tracking-wide text-[var(--loombus-gold)]">{item.type}</p><h3 className="mt-1 font-black">{item.label}</h3></div>
                      <button onClick={() => persist(FLOOR_WATCHLIST_KEY, watchItems.filter((entry) => entry.id !== item.id), setWatchItems)} aria-label="Remove watch item"><Trash2 className="size-4 text-rose-400" /></button>
                    </div>
                    {item.note ? <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">{item.note}</p> : null}
                    {item.type === "company" ? <Link href={`/the-floor/company/${encodeURIComponent(item.label)}`} className="mt-3 inline-flex text-xs font-black text-[var(--loombus-gold)]">Open Company Intelligence</Link> : <Link href="/the-floor/knowledge-graph" className="mt-3 inline-flex text-xs font-black text-[var(--loombus-gold)]">Explore connections</Link>}
                  </article>
                )) : <p className="text-sm text-[var(--loombus-text-muted)]">Your monitored universe is empty.</p>}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "journal" ? (
          <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
            <form onSubmit={addJournalEntry} className={cardClass}>
              <h2 className="text-lg font-black">Record a decision</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">Journal entries are append-only records. Add a new entry when your thinking changes.</p>
              <div className="mt-4 space-y-3">
                <input value={ticker} onChange={(event) => setTicker(normalizeFloorSymbol(event.target.value))} className={inputClass} placeholder="Ticker, optional" />
                <input value={journalTitle} onChange={(event) => setJournalTitle(event.target.value)} className={inputClass} placeholder="What changed?" />
                <textarea value={journalBody} onChange={(event) => setJournalBody(event.target.value)} className={areaClass} rows={7} placeholder="Record the evidence, reasoning, risk, or decision." />
                <label className="block text-xs font-black">Conviction: {conviction}%<input type="range" min="0" max="100" value={conviction} onChange={(event) => setConviction(Number(event.target.value))} className="mt-2 w-full" /></label>
                <button className={buttonClass}><Plus className="size-4" /> Add journal entry</button>
              </div>
            </form>
            <section className={cardClass}>
              <h2 className="text-lg font-black">Research timeline</h2>
              <div className="mt-4 space-y-4">
                {journal.length ? journal.map((entry) => (
                  <article key={entry.id} className="border-l-2 border-[var(--loombus-gold)] pl-4">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-black">{entry.ticker || "General research"}</span><span className="rounded-full bg-[var(--loombus-surface-muted)] px-2 py-1 text-[10px] font-black">{entry.conviction}% conviction</span></div>
                    <h3 className="mt-2 font-black">{entry.title}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">{entry.body}</p>
                    <time className="mt-2 block text-[11px] text-[var(--loombus-text-subtle)]">{new Date(entry.createdAt).toLocaleString()}</time>
                  </article>
                )) : <p className="text-sm text-[var(--loombus-text-muted)]">Your research timeline begins with your first entry.</p>}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "rooms" ? (
          <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
            <form onSubmit={createRoom} className={cardClass}>
              <h2 className="text-lg font-black">Create a research room</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">Define the room as a research organization with an objective, monitored universe, and assigned work.</p>
              <div className="mt-4 space-y-3">
                <input value={roomName} onChange={(event) => setRoomName(event.target.value)} className={inputClass} placeholder="Room name" />
                <input value={roomFocus} onChange={(event) => setRoomFocus(event.target.value)} className={inputClass} placeholder="Focus, for example AI Infrastructure" />
                <textarea value={roomObjective} onChange={(event) => setRoomObjective(event.target.value)} className={areaClass} rows={4} placeholder="Research objective" />
                <textarea value={roomWatchlist} onChange={(event) => setRoomWatchlist(event.target.value)} className={areaClass} rows={3} placeholder="Tickers, separated by commas" />
                <textarea value={roomTasks} onChange={(event) => setRoomTasks(event.target.value)} className={areaClass} rows={4} placeholder="Research tasks, one per line" />
                <button className={buttonClass}><Plus className="size-4" /> Create private room</button>
              </div>
            </form>
            <section className="space-y-4">
              {rooms.length ? rooms.map((room) => (
                <article key={room.id} className={cardClass}>
                  <div className="flex justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wide text-[var(--loombus-gold)]">{room.focus || "Research room"}</p><h2 className="mt-1 text-xl font-black">{room.name}</h2></div><button onClick={() => persist(FLOOR_ROOMS_KEY, rooms.filter((entry) => entry.id !== room.id), setRooms)} aria-label="Delete room"><Trash2 className="size-4 text-rose-400" /></button></div>
                  <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">{room.objective}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div><h3 className="flex items-center gap-2 text-xs font-black uppercase"><Eye className="size-3.5" /> Room watchlist</h3><div className="mt-2 flex flex-wrap gap-2">{room.watchlist.map((symbol) => <Link key={symbol} href={`/the-floor/company/${encodeURIComponent(symbol)}`} className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-black text-[var(--loombus-gold)]">{symbol}</Link>)}</div></div>
                    <div><h3 className="flex items-center gap-2 text-xs font-black uppercase"><CheckSquare className="size-3.5" /> Research tasks</h3><ul className="mt-2 space-y-2 text-sm text-[var(--loombus-text-muted)]">{room.tasks.map((task) => <li key={task}>• {task}</li>)}</ul></div>
                  </div>
                </article>
              )) : <div className={cardClass}><Users className="size-8 text-[var(--loombus-gold)]" /><h2 className="mt-3 text-lg font-black">No research rooms yet</h2><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Create a private room to organize a company, theme, sector, or macro research effort.</p></div>}
            </section>
          </div>
        ) : null}

        <section className={cardClass}>
          <p className="flex items-start gap-2 text-xs leading-5 text-[var(--loombus-text-muted)]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--loombus-gold)]" /> Watchlists and journal entries sync privately to the member's cloud account after the Floor migration is applied. Browser storage remains as a safe fallback. Research Rooms remain private and use role-based access in the new cloud schema.</p>
        </section>
      </div>
    </main>
  );
}
