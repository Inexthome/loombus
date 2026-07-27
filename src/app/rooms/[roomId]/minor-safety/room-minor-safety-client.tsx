"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ShieldCheck, UsersRound, LockKeyhole, Save, ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Payload = {
  canManage: boolean;
  roomId: string;
  room?: { id: string; name: string };
  settings?: {
    allowsMinors: boolean;
    requiresStaffApproval: boolean;
    adultContactMode: "teen_initiated" | "disabled";
  };
  activeTeenMemberCount?: number;
  error?: string;
};

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function RoomMinorSafetyClient() {
  const params = useParams<{ roomId: string }>();
  const roomId = String(params?.roomId ?? "");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [allowsMinors, setAllowsMinors] = useState(false);
  const [contactMode, setContactMode] = useState<"teen_initiated" | "disabled">("teen_initiated");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    const accessToken = await token();
    if (!accessToken) {
      window.location.href = `/login?next=${encodeURIComponent(`/rooms/${roomId}/minor-safety`)}`;
      return;
    }
    const response = await fetch(`/api/rooms/${roomId}/minor-safety`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const next = (await response.json().catch(() => ({}))) as Payload;
    setPayload(next);
    if (next.settings) {
      setAllowsMinors(Boolean(next.settings.allowsMinors));
      setContactMode(next.settings.adultContactMode ?? "teen_initiated");
    }
    if (!response.ok) setMessage(next.error ?? "Unable to load Room minor safety.");
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!roomId || saving) return;
    setSaving(true);
    setMessage("");
    const accessToken = await token();
    if (!accessToken) return;
    const response = await fetch(`/api/rooms/${roomId}/minor-safety`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        allowsMinors,
        adultContactMode: contactMode,
      }),
    });
    const next = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(next.error ?? "Unable to save Room minor safety.");
    } else {
      setMessage("Room minor-safety settings saved.");
      await load();
    }
    setSaving(false);
  }

  return (
    <main className="room-minor-safety-page">
      <section className="room-minor-safety-shell">
        <Link href={`/rooms/${roomId}`} className="room-minor-safety-back">
          <ArrowLeft aria-hidden="true" size={16} /> Back to Room
        </Link>
        <header className="room-minor-safety-hero">
          <div>
            <p>Room governance</p>
            <h1>Minor safety</h1>
            <span>
              Control whether teen members may participate and keep admission and contact boundaries explicit.
            </span>
          </div>
          <ShieldCheck aria-hidden="true" />
        </header>

        {loading ? <div className="room-minor-safety-state">Loading Room safety settings...</div> : null}
        {!loading && payload && !payload.canManage ? (
          <div className="room-minor-safety-state">Room owner or administrator access is required.</div>
        ) : null}

        {!loading && payload?.canManage ? (
          <>
            <section className="room-minor-safety-summary">
              <div><strong>{payload.room?.name ?? "Private Room"}</strong><span>Room</span></div>
              <div><strong>{payload.activeTeenMemberCount ?? 0}</strong><span>Active teen members</span></div>
              <div><strong>Required</strong><span>Staff approval</span></div>
            </section>

            <section className="room-minor-safety-card">
              <div className="room-minor-safety-card-heading">
                <UsersRound aria-hidden="true" />
                <div>
                  <h2>Teen participation</h2>
                  <p>Teen accounts can join only after Room staff approval and remain ordinary members.</p>
                </div>
              </div>
              <label className="room-minor-safety-toggle">
                <span>
                  <strong>Allow teen members</strong>
                  <small>Turning this off is blocked while active teen memberships remain.</small>
                </span>
                <input
                  type="checkbox"
                  checked={allowsMinors}
                  onChange={(event) => setAllowsMinors(event.target.checked)}
                />
              </label>
            </section>

            <section className="room-minor-safety-card">
              <div className="room-minor-safety-card-heading">
                <LockKeyhole aria-hidden="true" />
                <div>
                  <h2>Adult contact boundary</h2>
                  <p>Room membership never gives an adult permission to start private contact with a teen.</p>
                </div>
              </div>
              <label className="room-minor-safety-select">
                <span>Adult-to-teen private contact</span>
                <select
                  value={contactMode}
                  onChange={(event) =>
                    setContactMode(event.target.value === "disabled" ? "disabled" : "teen_initiated")
                  }
                >
                  <option value="teen_initiated">Teen must initiate</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              <p className="room-minor-safety-note">
                Loombus-wide message, block, report, and child-safety rules continue to apply inside every Room.
              </p>
            </section>

            {message ? <div className="room-minor-safety-message" role="status">{message}</div> : null}

            <button
              type="button"
              className="room-minor-safety-save"
              onClick={() => void save()}
              disabled={saving}
            >
              <Save aria-hidden="true" size={17} /> {saving ? "Saving..." : "Save minor safety"}
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}
