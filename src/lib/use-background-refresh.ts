"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type BackgroundRefreshState = "idle" | "refreshing" | "offline";

type BackgroundRefreshOptions = {
  refresh: () => Promise<void> | void;
  enabled?: boolean;
  intervalMs?: number;
  debounceMs?: number;
  events?: string[];
  refreshOnFocus?: boolean;
  refreshOnVisible?: boolean;
  refreshOnOnline?: boolean;
};

function pageCanRefresh() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return false;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }

  return true;
}

export function useBackgroundRefresh({
  refresh,
  enabled = true,
  intervalMs = 0,
  debounceMs = 160,
  events = [],
  refreshOnFocus = true,
  refreshOnVisible = true,
  refreshOnOnline = true,
}: BackgroundRefreshOptions) {
  const refreshRef = useRef(refresh);
  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);
  const [state, setState] = useState<BackgroundRefreshState>(() =>
    typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "idle"
  );
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  refreshRef.current = refresh;

  const runRefresh = useCallback(
    async (force = false) => {
      if (!enabled) return;

      if (!force && !pageCanRefresh()) {
        queuedRef.current = true;
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          setState("offline");
        }
        return;
      }

      if (inFlightRef.current) {
        queuedRef.current = true;
        return;
      }

      inFlightRef.current = true;
      queuedRef.current = false;
      if (mountedRef.current) setState("refreshing");

      try {
        await refreshRef.current();
        if (mountedRef.current) setLastUpdatedAt(new Date());
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) {
          setState(
            typeof navigator !== "undefined" && navigator.onLine === false
              ? "offline"
              : "idle"
          );
        }

        if (queuedRef.current && pageCanRefresh()) {
          queuedRef.current = false;
          window.setTimeout(() => void runRefresh(), 0);
        }
      }
    },
    [enabled]
  );

  const requestRefresh = useCallback(
    (delayMs = debounceMs) => {
      if (!enabled || typeof window === "undefined") return;
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        void runRefresh();
      }, Math.max(0, delayMs));
    },
    [debounceMs, enabled, runRefresh]
  );

  const refreshNow = useCallback(async () => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await runRefresh(true);
  }, [runRefresh]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;
    const interval = window.setInterval(() => requestRefresh(0), intervalMs);
    return () => window.clearInterval(interval);
  }, [enabled, intervalMs, requestRefresh]);

  useEffect(() => {
    if (!enabled) return;

    const handleFocus = () => {
      if (refreshOnFocus) requestRefresh(0);
    };
    const handlePageShow = () => {
      if (refreshOnFocus) requestRefresh(0);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && refreshOnVisible) {
        requestRefresh(0);
      }
    };
    const handleOnline = () => {
      setState("idle");
      if (refreshOnOnline) requestRefresh(0);
    };
    const handleOffline = () => setState("offline");
    const handleCustomEvent = () => requestRefresh();

    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    events.forEach((eventName) => window.addEventListener(eventName, handleCustomEvent));

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      events.forEach((eventName) => window.removeEventListener(eventName, handleCustomEvent));
    };
  }, [enabled, events, refreshOnFocus, refreshOnOnline, refreshOnVisible, requestRefresh]);

  return {
    state,
    isRefreshing: state === "refreshing",
    isOffline: state === "offline",
    lastUpdatedAt,
    requestRefresh,
    refreshNow,
  };
}
