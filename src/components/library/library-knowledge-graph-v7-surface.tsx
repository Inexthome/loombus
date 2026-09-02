"use client";

import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from "react";
import { RefreshCcw, Wifi, WifiOff } from "lucide-react";
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
        <section role="alert" aria-live="assertive" className="graph-editorial-recovery mx-auto mt-6 max-w-7xl px-4 py-6 text-[var(--loombus-text)] sm:px-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Graph recovery</p>
          <h2 className="mt-2 text-xl font-black">The graph could not finish rendering.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">Your saved workspaces and investigations remain private in Supabase. Retry the graph surface; no relationship or research record is changed by this recovery action.</p>
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
    <div className="graph-editorial-runtime min-h-screen pb-[env(safe-area-inset-bottom)]">
      <a href="#library-knowledge-graph" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-[var(--loombus-gold)] focus:px-4 focus:py-2 focus:font-black focus:text-black">Skip to Knowledge Graph</a>
      <div className="graph-editorial-runtime-band mx-auto max-w-7xl px-4 pt-3 text-[var(--loombus-text)] sm:px-6" aria-label="Knowledge Graph status">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[var(--loombus-border)] py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Private graph workspace</p>
            <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">Owner-scoped relationships · Alt+G focuses the graph</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-black">
            <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-[var(--loombus-text-muted)]">
              {online ? <Wifi className="size-4" aria-hidden="true" /> : <WifiOff className="size-4" aria-hidden="true" />}
              {online ? "Online" : "Offline"}
            </span>
            <button type="button" onClick={retry} className="inline-flex items-center gap-2 text-[var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)]" aria-label="Reload Knowledge Graph surface">
              <RefreshCcw className="size-4" aria-hidden="true" /> Reload
            </button>
          </div>
        </div>
      </div>
      <div id="library-knowledge-graph" ref={graphRef} tabIndex={-1} className="scroll-mt-4 focus:outline-none" aria-label="Library Knowledge Graph">
        <KnowledgeGraphErrorBoundary resetKey={resetKey} onError={() => setBoundaryFailed(true)}>
          <LibraryKnowledgeGraphV6Surface key={resetKey} />
        </KnowledgeGraphErrorBoundary>
      </div>
      {boundaryFailed ? (
        <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
          <button type="button" onClick={retry} className="inline-flex min-h-11 items-center gap-2 bg-[var(--loombus-gold)] px-4 text-sm font-black text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)]">
            <RefreshCcw className="size-4" aria-hidden="true" /> Retry graph
          </button>
        </div>
      ) : null}
    </div>
  );
}
