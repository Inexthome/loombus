"use client";

import { Flag, Loader2, Shield, X } from "lucide-react";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { RoomOperationsPanel } from "@/components/room-operations-panel";

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
function findHost() {
  const shell = document.querySelector(".rooms-live-page .rooms-live-shell");
  if (!shell) return null;
  let host = shell.querySelector("[data-loombus-room-operations-host='true']");
  if (!host) {
    host = document.createElement("div");
    host.dataset.loombusRoomOperationsHost = "true";
    const foundation = shell.querySelector("[data-loombus-room-foundation-host='true']");
    if (foundation) foundation.after(host); else shell.prepend(host);
  }
  return host;
}

export function RoomOperationsWorkspace() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? "", [rawRoomId]);
  const [host, setHost] = useState(null);
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let frame = 0;
    const scan = () => { frame = 0; setHost(findHost()); };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(scan); };
    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); document.querySelector("[data-loombus-room-operations-host='true']")?.remove(); };
  }, []);

  const request = useCallback(async (view, init) => {
    if (!roomId) throw new Error("Room could not be identified.");
    const accessToken = await token();
    if (!accessToken) throw new Error("Sign in again before continuing.");
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/operations?view=${encodeURIComponent(view)}`, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Room operation could not be completed.");
    return result;
  }, [roomId]);

  const loadSummary = useCallback(async () => {
    if (!roomId) return;
    try { setSummary(await request("summary")); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Room operations could not load."); }
  }, [request, roomId]);

  const loadOperations = useCallback(async () => {
    setLoading(true); setNotice("");
    try { const result = await request("operations"); setPayload(result); setSummary(result); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Room operations could not load."); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => {
    void loadSummary();
    const interval = window.setInterval(() => void loadSummary(), 60000);
    const refresh = () => { void loadSummary(); if (open) void loadOperations(); };
    window.addEventListener("loombus:room-operations-changed", refresh);
    return () => { clearInterval(interval); window.removeEventListener("loombus:room-operations-changed", refresh); };
  }, [loadOperations, loadSummary, open]);

  useEffect(() => { if (open) void loadOperations(); }, [loadOperations, open]);

  async function action(name, values = {}, success = "Room operation completed.") {
    if (working) return false;
    setWorking(name); setNotice("");
    try {
      const result = await request("operations", { method: "POST", body: JSON.stringify({ action: name, ...values }) });
      setNotice(success);
      if (result.url) { window.location.href = result.url; return true; }
      if (result.left || result.transferred || result.deleted) { window.location.href = "/rooms"; return true; }
      await Promise.all([loadSummary(), loadOperations()]);
      window.dispatchEvent(new Event("loombus:room-operations-changed"));
      return true;
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Room operation failed."); return false; }
    finally { setWorking(""); }
  }

  async function exportRoom() {
    if (working) return;
    setWorking("export"); setNotice("");
    try {
      const accessToken = await token();
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/operations?view=export`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || "Room export failed."); }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "loombus-room-export.json";
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
      setNotice("Room export downloaded.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Room export failed."); }
    finally { setWorking(""); }
  }

  if (!roomId || !host || !summary?.access) return null;
  const badge = summary.pendingReportCount > 99 ? "99+" : String(summary.pendingReportCount || "");

  return createPortal(
    <div className="room-operations">
      <button type="button" className="room-operations-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {summary.access.canModerate ? <Shield aria-hidden="true" /> : <Flag aria-hidden="true" />}
        <span>{summary.access.canModerate ? "Room Operations" : "Report Room Content"}</span>
        {badge ? <strong>{badge}</strong> : null}
      </button>
      {open ? (
        <section className="room-operations-panel">
          <header className="room-operations-heading">
            <div><p>{summary.room?.name || "Private Room"}</p><h2>Room Operations</h2><span>Membership, moderation, usage, billing, export, and lifecycle controls.</span></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close Room Operations"><X aria-hidden="true" /></button>
          </header>
          {notice ? <div className="room-operations-notice">{notice}</div> : null}
          {loading && !payload ? <div className="room-operations-loading"><Loader2 className="is-spinning" /> Loading operations</div> : null}
          {payload ? <RoomOperationsPanel payload={payload} working={working} onAction={action} onExport={exportRoom} onRefresh={loadOperations} /> : null}
        </section>
      ) : null}
    </div>,
    host
  );
}
