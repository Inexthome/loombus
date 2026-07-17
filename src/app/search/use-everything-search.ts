"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  buildSearchHref,
  type EverythingSearchResponse,
} from "@/lib/everything-search";
import { supabase } from "@/lib/supabase/client";
import {
  type AiSource,
  EMPTY_SEARCH,
  getSearchRouteState,
  getVisibleGroups,
  getVisibleResults,
  HISTORY_KEY,
  type SearchGroup,
} from "./everything-search-model";

export function useEverythingSearch() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<SearchGroup>("all");
  const [search, setSearch] = useState(EMPTY_SEARCH);
  const [accessToken, setAccessToken] = useState("");
  const [authResolved, setAuthResolved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [aiWorking, setAiWorking] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiUpgradeRequired, setAiUpgradeRequired] = useState(false);
  const [aiSources, setAiSources] = useState<AiSource[]>([]);

  useEffect(() => {
    const initial = getSearchRouteState();
    setQuery(initial.query);
    setActiveQuery(initial.query);
    setActiveGroup(initial.group);

    try {
      const stored = JSON.parse(
        window.localStorage.getItem(HISTORY_KEY) ?? "[]"
      );
      if (Array.isArray(stored)) {
        setHistory(
          stored.filter((item) => typeof item === "string").slice(0, 8)
        );
      }
    } catch {
      setHistory([]);
    }

    void supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        setAccessToken(data.session?.access_token ?? "");
        setAuthResolved(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setAccessToken(session?.access_token ?? "");
        setAuthResolved(true);
      }
    );

    function onPopState() {
      const next = getSearchRouteState();
      setQuery(next.query);
      setActiveQuery(next.query);
      setActiveGroup(next.group);
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (!authResolved) return;
    const clean = activeQuery.trim();

    if (clean.length < 2) {
      setSearch(EMPTY_SEARCH);
      setMessage("");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSearch() {
      setLoading(true);
      setMessage("");
      setAiAnswer("");
      setAiMessage("");
      setAiSources([]);

      try {
        const response = await fetch(
          `/api/search/everything?q=${encodeURIComponent(clean)}&limit=72`,
          {
            headers: accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : undefined,
            cache: "no-store",
          }
        );
        const payload = await response.json().catch(() => ({}));

        if (cancelled) return;
        if (!response.ok || !Array.isArray(payload.results)) {
          setSearch(EMPTY_SEARCH);
          setMessage(payload.error ?? "Everything Search could not load.");
          return;
        }

        setSearch(payload as EverythingSearchResponse);
      } catch {
        if (!cancelled) {
          setSearch(EMPTY_SEARCH);
          setMessage("Everything Search could not load. Refresh and try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timeoutId = window.setTimeout(loadSearch, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [accessToken, activeQuery, authResolved]);

  const visibleResults = useMemo(
    () => getVisibleResults(search.results, activeGroup),
    [activeGroup, search.results]
  );
  const groups = useMemo(() => getVisibleGroups(search), [search]);
  const hasQuery = activeQuery.trim().length >= 2;

  function persist(value: string) {
    const clean = value.trim();
    if (clean.length < 2) return;

    const next = [
      clean,
      ...history.filter(
        (item) => item.toLowerCase() !== clean.toLowerCase()
      ),
    ].slice(0, 8);

    setHistory(next);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  function updateUrl(
    nextQuery: string,
    nextGroup: SearchGroup,
    push = true
  ) {
    window.history[push ? "pushState" : "replaceState"](
      null,
      "",
      buildSearchHref(nextQuery, nextGroup)
    );
  }

  function runSearch(value: string) {
    setQuery(value);
    setActiveQuery(value);
    setActiveGroup("all");
    persist(value);
    updateUrl(value, "all");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length >= 2) runSearch(query.trim());
  }

  function selectGroup(group: SearchGroup) {
    setActiveGroup(group);
    updateUrl(activeQuery, group, false);
  }

  async function askAi() {
    if (aiWorking || loading || activeQuery.trim().length < 2) return;

    if (!accessToken) {
      window.location.href = `/login?next=${encodeURIComponent(
        buildSearchHref(activeQuery)
      )}`;
      return;
    }

    setAiWorking(true);
    setAiAnswer("");
    setAiMessage("");
    setAiSources([]);
    setAiUpgradeRequired(false);

    try {
      const context = search.results.slice(0, 12).map((result) => ({
        kind: result.sourceLabel,
        title: result.title,
        description: [
          result.snippet,
          result.ownerName ? `Contributor: ${result.ownerName}` : "",
          result.roomName ? `Room: ${result.roomName}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        href: result.href,
      }));

      const response = await fetch("/api/search/ai", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: activeQuery, context }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAiUpgradeRequired(Boolean(payload.upgradeRequired));
        setAiMessage(payload.error ?? "Unable to ask Loombus AI.");
        return;
      }

      setAiAnswer(String(payload.answer ?? ""));
      setAiSources(
        search.results.slice(0, 10).map((result) => ({
          title: result.title,
          href: result.href,
        }))
      );
    } catch {
      setAiMessage("Unable to ask Loombus AI. Try again.");
    } finally {
      setAiWorking(false);
    }
  }

  return {
    query,
    setQuery,
    activeQuery,
    activeGroup,
    search,
    loading,
    message,
    history,
    hasQuery,
    visibleResults,
    groups,
    aiWorking,
    aiAnswer,
    aiMessage,
    aiUpgradeRequired,
    aiSources,
    submit,
    runSearch,
    selectGroup,
    askAi,
  };
}
