"use client";

import Link from "next/link";
import { FileClock, FileSearch, Settings2, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function RoomToolsShortcuts() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [allowed, setAllowed] = useState(false);
  const [owner, setOwner] = useState(false);
  const [manager, setManager] = useState(false);
  const [archived, setArchived] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) return;

      const workspace = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const workspaceResult = (await workspace.json().catch(() => ({}))) as {
        access?: { allowed?: boolean; role?: string | null };
      };
      if (!cancelled && workspace.ok && workspaceResult.access?.allowed) {
        const role = workspaceResult.access.role;
        setAllowed(true);
        setOwner(role === "owner");
        setManager(role === "owner" || role === "administrator");
        return;
      }

      const lifecycle = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/lifecycle`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      const lifecycleResult = (await lifecycle.json().catch(() => ({}))) as {
        room?: { isArchived?: boolean };
      };
      if (!cancelled && lifecycle.ok) {
        setOwner(true);
        setManager(true);
        setArchived(Boolean(lifecycleResult.room?.isArchived));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (!allowed && !owner) return null;

  return (
    <div className="rooms-live-shell">
      <nav className="room-workspace-tabs" aria-label="Room tools">
        {allowed ? (
          <Link href={`/rooms/${encodeURIComponent(roomId)}/tools`}>
            <FileSearch aria-hidden="true" />
            Search Room
          </Link>
        ) : null}
        {manager ? (
          <Link href={`/rooms/${encodeURIComponent(roomId)}/governance`}>
            <ShieldCheck aria-hidden="true" />
            Governance
          </Link>
        ) : null}
        {owner ? (
          <Link href={`/rooms/${encodeURIComponent(roomId)}/retention`}>
            <FileClock aria-hidden="true" />
            Retention
          </Link>
        ) : null}
        {owner ? (
          <Link href={`/rooms/${encodeURIComponent(roomId)}/tools`}>
            <Settings2 aria-hidden="true" />
            {archived ? "Archived Room controls" : "Export and lifecycle"}
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
