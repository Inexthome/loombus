"use client";

import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from "react";
import { RefreshCcw, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { LibraryKnowledgeGraphV6Surface } from "@/components/library/library-knowledge-graph-v6-surface";

type BoundaryProps = { children: ReactNode; resetKey: number; onError: () => void };
type BoundaryState = { failed: boolean };

class KnowledgeGraphErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onError();
  }

  componentDidUpdate(previous: BoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <section role="alert" aria-live="assertive" className="mx-auto mt-6 max-w-7xl rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 text-[var(--loombus-text)]">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Knowledge Graph recovery</p>
          <h2 className="mt-2 text-xl font-black">The graph could not finish rendering.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">Your saved workspaces and investigations remain private in Supabase. Retry the graph surface; no graph relationship or research record is changed by this recovery action.</p>
        </section>
      );
    }
    return this.props.children;
  }
}

export function LibraryKnowledgeGraphV7Surface() {
  const [resetKey, setResetKey] = useState(0);
  const [online, setOnline] = useState(true);
  const [boundaryFailed, setBoundaryFailed] = useState(false);
  const graphRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "g") {
        event.preventDefault();
        graphRef.current?.focus({ preventScroll: true });
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        graphRef.current?.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const retry = () => {
    setBoundaryFailed(false);
    setResetKey((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-[var(--loombus-page-bg)] pb-[env(safe-area-inset-bottom)]">
      <a href="#library-knowledge-graph" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--loombus-gold)] focus:px-4 focus:py-2 focus:font-black focus:text-black">Skip to Knowledge Graph</a>
      <div className="mx-auto max-w-7xl px-4 pt-4 text-[var(--loombus-text)] sm:px-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Knowledge Graph status">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--loombus-gold)]" aria-hidden="true" />
            <div>
              <p className="text-sm font-black">Knowledge Graph v7 · final hardening</p>
              <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">Private RLS-backed graph, persistent workspaces, deterministic pathfinding, reduced-motion-aware navigation, keyboard access, connection state, and render recovery.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span role="status" aria-live="polite" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-3 text-xs font-black">
              {online ? <Wifi className="size-4" aria-hidden="true" /> : <WifiOff className="size-4" aria-hidden="true" />}
              {online ? "Online" : "Offline — changes are unavailable"}
            </span>
            <button type="button" onClick={retry} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-3 text-xs font-black text-[var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--loombus-page-bg)]" aria-label="Reload Knowledge Graph surface">
              <RefreshCcw className="size-4" aria-hidden="true" /> Reload graph
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-[var(--loombus-text-subtle)]">Keyboard shortcut: Alt+G focuses the graph. Destructive workspace/view actions remain governed by the existing owner-only RLS policies.</p>
      </div>
      <div id="library-knowledge-graph" ref={graphRef} tabIndex={-1} className="scroll-mt-4 focus:outline-none" aria-label="Library Knowledge Graph">
        <KnowledgeGraphErrorBoundary resetKey={resetKey} onError={() => setBoundaryFailed(true)}>
          <LibraryKnowledgeGraphV6Surface key={resetKey} />
        </KnowledgeGraphErrorBoundary>
      </div>
      {boundaryFailed ? (
        <div className="mx-auto -mt-16 max-w-7xl px-4 pb-24 sm:px-6">
          <button type="button" onClick={retry} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 text-sm font-black text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--loombus-page-bg)]">
            <RefreshCcw className="size-4" aria-hidden="true" /> Retry graph
          </button>
        </div>
      ) : null}
    </div>
  );
}
