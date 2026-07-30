"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { RoomFoundationInboxPanel } from "@/components/room-foundation-inbox-panel";
import { RoomFoundationSearchPanel } from "@/components/room-foundation-search-panel";
import {
  MODULE_LABELS,
  PAGE_SIZE,
  type ActivityPayload,
  type SearchPayload,
} from "@/components/room-foundation-types";
import { useRoomWorkspace } from "@/components/room-workspace-context";
import { isRoomModuleKey } from "@/lib/room-plan-entitlements";
import { supabase } from "@/lib/supabase/client";

type FoundationPanel = "search" | "inbox";

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function RoomFoundationFeature({ panel }: { panel: FoundationPanel }) {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const { openFeature } = useRoomWorkspace();
  const [summary, setSummary] = useState<ActivityPayload | null>(null);
  const [inbox, setInbox] = useState<ActivityPayload | null>(null);
  const [searchPayload, setSearchPayload] = useState<SearchPayload | null>(null);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingPanel, setLoadingPanel] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const resultsHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);

  const request = useCallback(
    async (view: string, init?: RequestInit, extra?: URLSearchParams) => {
      if (!roomId) throw new Error("Room could not be identified.");
      const token = await accessToken();
      if (!token) throw new Error("Sign in again before continuing.");
      const queryParams = new URLSearchParams(extra);
      queryParams.set("view", view);
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/foundation?${queryParams.toString()}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
            ...(init?.headers ?? {}),
          },
          cache: "no-store",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as
        | ActivityPayload
        | SearchPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Room activity could not be loaded.");
      }
      return payload;
    },
    [roomId]
  );

  const loadSummary = useCallback(async () => {
    if (!roomId) return;
    setLoadingSummary(true);
    try {
      setSummary((await request("summary")) as ActivityPayload);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Room activity could not load."
      );
      setNoticeError(true);
    } finally {
      setLoadingSummary(false);
    }
  }, [request, roomId]);

  const focusResults = useCallback(() => {
    window.requestAnimationFrame(() => resultsHeadingRef.current?.focus());
  }, []);

  const loadInbox = useCallback(
    async (page = 1, focus = false) => {
      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;
      setLoadingPanel(true);
      setNotice("");
      setNoticeError(false);
      try {
        const queryParams = new URLSearchParams({
          page: String(Math.max(1, page)),
          limit: String(PAGE_SIZE),
        });
        const payload = (await request(
          "inbox",
          { signal: controller.signal },
          queryParams
        )) as ActivityPayload;
        setInbox(payload);
        setSummary((current) => ({
          ...(current ?? {}),
          room: payload.room ?? current?.room,
          preferences: payload.preferences ?? current?.preferences,
          unreadCount: payload.unreadCount ?? current?.unreadCount,
          unreadCapped: payload.unreadCapped ?? current?.unreadCapped,
        }));
        if (focus) focusResults();
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          setNotice(
            error instanceof Error ? error.message : "Room inbox could not load."
          );
          setNoticeError(true);
        }
      } finally {
        if (requestAbortRef.current === controller) setLoadingPanel(false);
      }
    },
    [focusResults, request]
  );

  const loadSearch = useCallback(
    async (page = 1, focus = false) => {
      const cleaned = query.trim();
      if (cleaned.length < 2) {
        setNotice("Enter at least two characters to search this Room.");
        setNoticeError(true);
        setSearchPayload({ results: [], pageInfo: null });
        return;
      }
      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;
      setLoadingPanel(true);
      setNotice("");
      setNoticeError(false);
      try {
        const queryParams = new URLSearchParams({
          q: cleaned,
          page: String(Math.max(1, page)),
          limit: String(PAGE_SIZE),
        });
        if (moduleFilter) queryParams.set("module", moduleFilter);
        const payload = (await request(
          "search",
          { signal: controller.signal },
          queryParams
        )) as SearchPayload;
        setSearchPayload(payload);
        if (focus) focusResults();
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          setNotice(
            error instanceof Error ? error.message : "Room search could not run."
          );
          setNoticeError(true);
        }
      } finally {
        if (requestAbortRef.current === controller) setLoadingPanel(false);
      }
    },
    [focusResults, moduleFilter, query, request]
  );

  useEffect(() => {
    void loadSummary();
    const interval = window.setInterval(() => void loadSummary(), 60_000);
    const refresh = () => void loadSummary();
    window.addEventListener("loombus:room-activity-changed", refresh);
    return () => {
      requestAbortRef.current?.abort();
      window.clearInterval(interval);
      window.removeEventListener("loombus:room-activity-changed", refresh);
    };
  }, [loadSummary]);

  useEffect(() => {
    if (panel === "search") {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    } else {
      void loadInbox(1);
    }
  }, [loadInbox, panel]);

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadSearch(1, true);
  }

  async function postAction(
    action: string,
    values: Record<string, unknown> = {}
  ) {
    setWorking(true);
    setNotice("");
    setNoticeError(false);
    try {
      const payload = (await request("preferences", {
        method: "POST",
        body: JSON.stringify({ action, ...values }),
      })) as ActivityPayload;
      if (payload.preferences) {
        setInbox((current) =>
          current
            ? {
                ...current,
                preferences: payload.preferences,
                ...(action === "mark_read" ? { unreadCount: 0 } : {}),
              }
            : current
        );
        setSummary((current) =>
          current
            ? {
                ...current,
                preferences: payload.preferences,
                ...(action === "mark_read" ? { unreadCount: 0 } : {}),
              }
            : current
        );
      }
      if (action === "mark_read") setNotice("Room activity marked read.");
      if (action === "update_preferences") await loadInbox(1);
      window.dispatchEvent(new Event("loombus:room-activity-changed"));
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Room preferences could not be updated."
      );
      setNoticeError(true);
    } finally {
      setWorking(false);
    }
  }

  function openModule(moduleKey: string) {
    if (!isRoomModuleKey(moduleKey)) return;
    openFeature({
      id: `module:${moduleKey}`,
      kind: "module",
      moduleKey,
      label: MODULE_LABELS[moduleKey] ?? "Room module",
    });
  }

  return (
    <div className="room-phase3-foundation" aria-busy={loadingPanel}>
      {notice ? (
        <div
          className="room-foundation-notice"
          role={noticeError ? "alert" : "status"}
        >
          {notice}
        </div>
      ) : null}
      {panel === "search" ? (
        <RoomFoundationSearchPanel
          query={query}
          moduleFilter={moduleFilter}
          searchPayload={searchPayload}
          loadingPanel={loadingPanel}
          resultsHeadingRef={resultsHeadingRef}
          searchInputRef={searchInputRef}
          setQuery={setQuery}
          setModuleFilter={setModuleFilter}
          handleSearchSubmit={handleSearchSubmit}
          loadSearch={loadSearch}
          openModule={openModule}
        />
      ) : (
        <RoomFoundationInboxPanel
          inbox={inbox}
          summary={summary}
          loadingPanel={loadingPanel || loadingSummary}
          working={working}
          resultsHeadingRef={resultsHeadingRef}
          postAction={postAction}
          loadInbox={loadInbox}
          openModule={openModule}
        />
      )}
    </div>
  );
}
