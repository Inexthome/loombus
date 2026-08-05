"use client";

import Link from "next/link";
import {
  CreditCard,
  FileClock,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useRoomWorkspace } from "@/components/room-workspace-context";
import { supabase } from "@/lib/supabase/client";

type ManifestModule = { id?: string; label?: string };
type Manifest = {
  modules?: ManifestModule[];
  access?: {
    canManage?: boolean;
    isOwner?: boolean;
  };
};

export function RoomSettingsDirectory() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const { openFeature } = useRoomWorkspace();
  const [manifest, setManifest] = useState<Manifest | null>(null);

  useEffect(() => {
    if (!roomId) return;
    let live = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/modules?module=manifest`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      const result = (await response.json().catch(() => ({}))) as Manifest;
      if (live && response.ok) setManifest(result);
    })();
    return () => {
      live = false;
    };
  }, [roomId]);

  if (!roomId) return null;

  const moduleIds = new Set((manifest?.modules ?? []).map((item) => item.id));
  const canManage = manifest?.access?.canManage === true;
  const isOwner = manifest?.access?.isOwner === true;
  const roomBase = `/rooms/${encodeURIComponent(roomId)}`;

  return (
    <section className="room-phase4-settings-directory" aria-labelledby="room-settings-directory-title">
      <div>
        <p>Management settings</p>
        <h3 id="room-settings-directory-title">Room administration in one place</h3>
        <span>
          Security, governance, retention, billing, and audit destinations keep their
          existing authorization while sharing this Settings workspace.
        </span>
      </div>
      <div className="room-phase4-settings-grid">
        {moduleIds.has("activity") ? (
          <button
            type="button"
            onClick={(event) =>
              openFeature(
                {
                  id: "module:activity",
                  kind: "module",
                  moduleKey: "activity",
                  label: "Activity / Audit Log",
                },
                event.currentTarget
              )
            }
          >
            <ScrollText aria-hidden="true" />
            <span><strong>Activity / Audit Log</strong><small>Review authorized Room activity.</small></span>
          </button>
        ) : null}

        {moduleIds.has("advanced-controls") ? (
          <button
            type="button"
            onClick={(event) =>
              openFeature(
                {
                  id: "module:advanced-controls",
                  kind: "module",
                  moduleKey: "advanced-controls",
                  label: "Advanced Room Controls",
                },
                event.currentTarget
              )
            }
          >
            <SlidersHorizontal aria-hidden="true" />
            <span><strong>Advanced Room Controls</strong><small>Configure plan-gated controls.</small></span>
          </button>
        ) : null}

        {canManage ? (
          <Link href={`${roomBase}/governance`}>
            <ShieldCheck aria-hidden="true" />
            <span><strong>Ownership &amp; Governance</strong><small>Roles, ownership, and governance state.</small></span>
          </Link>
        ) : null}

        {canManage ? (
          <Link href={`${roomBase}/age-safety`}>
            <Sparkles aria-hidden="true" />
            <span><strong>Minor Safety</strong><small>Age-aware protections and oversight.</small></span>
          </Link>
        ) : null}

        {isOwner ? (
          <Link href={`${roomBase}/retention`}>
            <FileClock aria-hidden="true" />
            <span><strong>Retention</strong><small>Retention periods and legal safeguards.</small></span>
          </Link>
        ) : null}

        {isOwner ? (
          <Link href={`${roomBase}/billing`}>
            <CreditCard aria-hidden="true" />
            <span><strong>Billing</strong><small>Subscription and secure billing portal.</small></span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
