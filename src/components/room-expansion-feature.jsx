"use client";

import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  Files,
  ListTodo,
  Loader2,
  RefreshCw,
  Vote,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExpansionBody } from "@/components/room-expansion-views";
import { supabase } from "@/lib/supabase/client";

const STUDIO_VIEWS = [
  ["tasks", "Tasks", ListTodo],
  ["polls", "Decisions", Vote],
  ["forms", "Forms", ClipboardList],
  ["knowledge", "Knowledge", BookOpen],
  ["calendar", "Calendar", CalendarDays],
  ["files", "Files", Files],
];
const PAGED_VIEWS = new Set(["tasks", "polls", "forms", "knowledge", "files"]);
const STUDIO_PAGE_SIZE = 24;

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function RoomExpansionFeature({
  initialView = "tasks",
  hideNavigation = false,
}) {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [manifest, setManifest] = useState(null);
  const [members, setMembers] = useState([]);
  const [activeView, setActiveView] = useState(initialView);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [pageByView, setPageByView] = useState({});
  const membersLoadedRef = useRef(false);
  const loadAbortRef = useRef(null);
  const resultsRef = useRef(null);
  const focusResultsRef = useRef(false);

  const request = useCallback(
    async (view, init, extra) => {
      if (!roomId) throw new Error("Room could not be identified.");
      const accessToken = await token();
      if (!accessToken) throw new Error("Sign in again before continuing.");
      const query = extra ?? new URLSearchParams();
      if (view) query.set("view", view);
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/expansion?${query.toString()}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
            ...(init?.headers ?? {}),
          },
          cache: "no-store",
        }
      );
      if (view === "form_export" && response.ok) return response;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.error ?? "Room Studio could not complete this request."
        );
      }
      return payload.data ?? payload;
    },
    [roomId]
  );

  const loadManifest = useCallback(async () => {
    if (!roomId) return;
    try {
      setManifest(await request("manifest"));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Room Studio could not load."
      );
      setNoticeError(true);
    }
  }, [request, roomId]);

  const loadMembers = useCallback(
    async (signal) => {
      if (membersLoadedRef.current || !roomId) return;
      const accessToken = await token();
      if (!accessToken) throw new Error("Sign in again before continuing.");
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal,
      });
      const workspace = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(workspace.error || "Room members could not be loaded.");
      }
      setMembers(Array.isArray(workspace.members) ? workspace.members : []);
      membersLoadedRef.current = true;
    },
    [roomId]
  );

  const loadView = useCallback(
    async (view, requestedPage = 1, { focusResults = false } = {}) => {
      loadAbortRef.current?.abort();
      const controller = new AbortController();
      loadAbortRef.current = controller;
      setLoading(true);
      setNotice("");
      setNoticeError(false);
      try {
        if (view === "tasks") await loadMembers(controller.signal);
        const query = new URLSearchParams();
        if (PAGED_VIEWS.has(view)) {
          query.set("page", String(Math.max(1, requestedPage)));
          query.set("limit", String(STUDIO_PAGE_SIZE));
        }
        const next = await request(view, { signal: controller.signal }, query);
        setData(next);
        if (next?.pageInfo?.page) {
          setPageByView((current) => ({
            ...current,
            [view]: next.pageInfo.page,
          }));
        }
        focusResultsRef.current = focusResults;
      } catch (error) {
        if (error?.name === "AbortError") return;
        setData(null);
        setNotice(
          error instanceof Error ? error.message : "Room Studio could not load."
        );
        setNoticeError(true);
      } finally {
        if (loadAbortRef.current === controller) setLoading(false);
      }
    },
    [loadMembers, request]
  );

  useEffect(() => {
    membersLoadedRef.current = false;
    setMembers([]);
    setPageByView({});
    setActiveView(initialView);
    void loadManifest();
    return () => loadAbortRef.current?.abort();
  }, [initialView, loadManifest, roomId]);

  useEffect(() => {
    setData(null);
    void loadView(activeView, 1);
  }, [activeView, loadView]);

  useEffect(() => {
    if (!loading && focusResultsRef.current && data) {
      focusResultsRef.current = false;
      window.requestAnimationFrame(() => resultsRef.current?.focus());
    }
  }, [data, loading]);

  async function action(payload, success, reloadView = activeView) {
    if (working) return null;
    setWorking(true);
    setNotice("");
    setNoticeError(false);
    try {
      const result = await request("", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setNotice(result.confirmationMessage || success);
      await loadView(reloadView, pageByView[reloadView] ?? 1);
      window.dispatchEvent(new Event("loombus:room-activity-changed"));
      return result;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Room Studio action failed."
      );
      setNoticeError(true);
      return null;
    } finally {
      setWorking(false);
    }
  }

  function selectView(view) {
    if (view === activeView) {
      void loadView(view, pageByView[view] ?? 1);
      return;
    }
    setPageByView((current) => ({ ...current, [view]: 1 }));
    setData(null);
    setActiveView(view);
  }

  function changePage(page) {
    void loadView(activeView, page, { focusResults: true });
  }

  const accent = manifest?.organization?.branding?.accent;

  return (
    <div
      className="room-phase3-expansion"
      style={accent ? { "--room-expansion-accent": accent } : undefined}
    >
      {manifest?.organization ? (
        <div className="room-expansion-brand room-phase3-organization-brand">
          {manifest.organization.branding?.logoUrl ? (
            <img src={manifest.organization.branding.logoUrl} alt="" />
          ) : (
            <Building2 aria-hidden="true" />
          )}
          <strong>{manifest.organization.name}</strong>
        </div>
      ) : null}

      <div className="room-phase3-feature-actions">
        <button
          type="button"
          className="rooms-live-secondary-action"
          onClick={() => void loadView(activeView, pageByView[activeView] ?? 1)}
          disabled={loading}
        >
          <RefreshCw className={loading ? "is-spinning" : ""} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {!hideNavigation ? (
        <nav
          className="room-expansion-tabs"
          aria-label="Room Studio areas"
          role="tablist"
        >
          {STUDIO_VIEWS.map(([value, label, Icon]) => (
            <button
              key={value}
              id={`room-studio-tab-${value}`}
              type="button"
              role="tab"
              aria-selected={activeView === value}
              aria-controls="room-studio-panel"
              tabIndex={activeView === value ? 0 : -1}
              onClick={() => selectView(value)}
            >
              <Icon aria-hidden="true" />
              {label}
            </button>
          ))}
          {manifest?.capabilities?.organization ? (
            <button
              id="room-studio-tab-organization"
              type="button"
              role="tab"
              aria-selected={activeView === "organization"}
              aria-controls="room-studio-panel"
              tabIndex={activeView === "organization" ? 0 : -1}
              onClick={() => selectView("organization")}
            >
              <Building2 aria-hidden="true" />
              Organization
            </button>
          ) : null}
        </nav>
      ) : null}

      {notice ? (
        <div
          role={noticeError ? "alert" : "status"}
          aria-live={noticeError ? "assertive" : "polite"}
          className={`room-expansion-notice${noticeError ? " is-error" : ""}`}
        >
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="room-expansion-loading" role="status" aria-live="polite">
          <Loader2 className="is-spinning" aria-hidden="true" />
          Loading {activeView.replaceAll("_", " ")}
        </div>
      ) : (
        <div
          id="room-studio-panel"
          ref={resultsRef}
          className="room-expansion-results"
          role="tabpanel"
          aria-labelledby={hideNavigation ? undefined : `room-studio-tab-${activeView}`}
          aria-label={hideNavigation ? activeView.replaceAll("_", " ") : undefined}
          aria-busy={working}
          tabIndex={-1}
        >
          <ExpansionBody
            view={activeView}
            data={data}
            manifest={manifest}
            members={members}
            working={working}
            loading={loading}
            action={action}
            request={request}
            onPageChange={changePage}
          />
        </div>
      )}
    </div>
  );
}
