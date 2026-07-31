"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { analystPath } from "@/lib/floor-credibility";
import { floorDisplayName } from "@/lib/floor-shared";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, Medal, ShieldCheck, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type FloorCredibilityRow = {
  member_id: string;
  username: string | null;
  full_name: string | null;
  pending_calls: number;
  resolved_calls: number;
  correct_calls: number;
  incorrect_calls: number;
  partial_calls: number;
  accuracy_pct: number | string | null;
  last_resolved_at: string | null;
};

function accuracyValue(value: FloorCredibilityRow["accuracy_pct"]) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : null;
}

function maturityLabel(row: FloorCredibilityRow) {
  if (row.resolved_calls >= 20) return "Established sample";
  if (row.resolved_calls >= 5) return "Developing sample";
  return "Emerging sample";
}

const RANK_STYLES = ["text-[var(--loombus-gold)]", "text-zinc-300", "text-amber-700"];

export default function TheFloorLeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FloorCredibilityRow[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("floor_member_credibility")
      .select("member_id, username, full_name, pending_calls, resolved_calls, correct_calls, incorrect_calls, partial_calls, accuracy_pct, last_resolved_at")
      .order("accuracy_pct", { ascending: false, nullsFirst: false })
      .order("resolved_calls", { ascending: false })
      .limit(50);
    if (!error && data) setRows(data as FloorCredibilityRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function guardAndLoad() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.replace("/login?next=%2Fthe-floor%2Fleaderboard");
        return;
      }
      if (mounted) await load();
    }
    void guardAndLoad();
    return () => {
      mounted = false;
    };
  }, [load]);

  if (loading) {
    return <LoombusLoadingScreen title="Loading the leaderboard..." message="Computing accountable research track records." />;
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <header className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10">
          <Link href="/the-floor" className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to The Floor
          </Link>
          <div className="mt-3 flex items-start gap-3">
            <Trophy className="mt-1 size-7 text-[var(--loombus-gold)]" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-black sm:text-3xl">Analyst credibility leaderboard</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                Rankings begin with resolved falsifiable calls. Open an analyst profile for the full explainable credibility model, including transparency, consistency, research depth, and accountability.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-3 text-xs font-bold text-[var(--loombus-text-muted)]">
            <ShieldCheck className="size-4 shrink-0 text-[var(--loombus-gold)]" /> Credibility cannot be purchased or manually edited. It is not a buy, hold, or sell rating.
          </div>
        </header>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[1.75rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">
            <Medal className="size-8 text-[var(--loombus-text-subtle)]" aria-hidden="true" />
            <p className="text-sm font-bold text-[var(--loombus-text-muted)]">No track records yet. Analyst credibility appears after falsifiable calls begin resolving.</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {rows.map((row, index) => {
              const accuracy = accuracyValue(row.accuracy_pct);
              return (
                <li key={row.member_id}>
                  <Link href={analystPath(row.member_id)} className="flex items-center gap-4 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 shadow-xl shadow-black/10 transition hover:border-[var(--loombus-gold)]">
                    <span className={`w-8 shrink-0 text-center text-lg font-black ${RANK_STYLES[index] ?? "text-[var(--loombus-text-subtle)]"}`}>#{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-[var(--loombus-text)]">{floorDisplayName(row.full_name, row.username)}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-[var(--loombus-text-muted)]">
                        <span>{row.resolved_calls} resolved</span>
                        <span className="text-emerald-400">{row.correct_calls} correct</span>
                        <span className="text-rose-400">{row.incorrect_calls} incorrect</span>
                        {row.partial_calls > 0 ? <span className="text-amber-400">{row.partial_calls} partial</span> : null}
                        <span>{maturityLabel(row)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1.5 text-sm font-black text-[var(--loombus-gold)]">{accuracy === null ? "—" : `${accuracy}%`}</span>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">Resolved accuracy</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}
