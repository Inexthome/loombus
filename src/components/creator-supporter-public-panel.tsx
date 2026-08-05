"use client";

import Link from "next/link";
import {
  Check,
  DoorOpen,
  HeartHandshake,
  Loader2,
  LockKeyhole,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import "./creator-supporter-public-panel.css";

type PublicTier = {
  id: string;
  name: string;
  description: string;
  benefits: string[] | null;
  room_id: string | null;
  position: number;
};

type PublicProgramPayload = {
  active: boolean;
  isOwner?: boolean;
  creator?: {
    id: string;
    fullName: string | null;
    username: string | null;
  };
  program?: {
    headline: string;
    welcomeMessage: string;
  };
  tiers?: PublicTier[];
  membership?: {
    id: string;
    tierId: string | null;
    joinedAt: string;
  } | null;
  supporterCount?: number;
  error?: string;
};

export function CreatorSupporterPublicPanel({ username }: { username: string }) {
  const [payload, setPayload] = useState<PublicProgramPayload | null>(null);
  const [selectedTierId, setSelectedTierId] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadProgram() {
    const token = await getToken();
    if (!token) return;

    const response = await fetch(
      `/api/creator/supporter-program/public?username=${encodeURIComponent(username)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    const result = (await response.json().catch(() => ({}))) as PublicProgramPayload;

    if (!response.ok) {
      setPayload(null);
      return;
    }

    setPayload(result);
    setSelectedTierId(
      result.membership?.tierId ?? result.tiers?.[0]?.id ?? ""
    );
  }

  useEffect(() => {
    void loadProgram();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  async function updateMembership(action: "join" | "change_tier" | "leave") {
    if (!payload?.creator || working) return;
    setWorking(true);
    setMessage("");
    const token = await getToken();

    if (!token) {
      window.location.href = `/login?next=/u/${encodeURIComponent(username)}`;
      return;
    }

    const response = await fetch("/api/creator/supporter-membership", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        creatorId: payload.creator.id,
        tierId: selectedTierId,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setWorking(false);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to update supporter access.");
      return;
    }

    setMessage(
      action === "leave"
        ? "You left this supporter program."
        : payload.membership
          ? "Your supporter tier was updated."
          : "You joined this free supporter program."
    );
    await loadProgram();
  }

  if (!payload?.active || !payload.program || !payload.tiers?.length) return null;

  const isMember = Boolean(payload.membership);
  const currentTier = payload.tiers.find(
    (tier) => tier.id === payload.membership?.tierId
  );

  return (
    <section className="creator-supporter-public-panel" aria-label="Creator supporter program">
      <header>
        <div>
          <p>Creator Supporters</p>
          <h2>{payload.program.headline}</h2>
          {payload.program.welcomeMessage ? (
            <span>{payload.program.welcomeMessage}</span>
          ) : null}
        </div>
        <div className="creator-supporter-public-count">
          <Users aria-hidden="true" />
          <strong>{payload.supporterCount ?? 0}</strong>
          <span>supporters</span>
        </div>
      </header>

      {payload.isOwner ? (
        <div className="creator-supporter-public-owner">
          <HeartHandshake aria-hidden="true" />
          <span>This is your free supporter program.</span>
          <Link href="/profile?section=creator">Manage program</Link>
        </div>
      ) : (
        <>
          <div className="creator-supporter-public-tiers">
            {payload.tiers.map((tier) => {
              const selected = selectedTierId === tier.id;
              const current = payload.membership?.tierId === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  className={selected ? "is-selected" : ""}
                  aria-pressed={selected}
                  onClick={() => setSelectedTierId(tier.id)}
                >
                  <span className="creator-supporter-public-tier-check">
                    {selected ? <Check aria-hidden="true" /> : null}
                  </span>
                  <strong>{tier.name}</strong>
                  {current ? <small className="is-current">Current tier</small> : null}
                  <p>{tier.description}</p>
                  {tier.benefits?.length ? (
                    <ul>
                      {tier.benefits.map((benefit) => (
                        <li key={benefit}>
                          <Check aria-hidden="true" /> {benefit}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {tier.room_id ? (
                    <small className="creator-supporter-public-room">
                      <LockKeyhole aria-hidden="true" /> Includes private Room access
                    </small>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="creator-supporter-public-actions">
            <button
              type="button"
              className="is-primary"
              disabled={working || !selectedTierId || payload.membership?.tierId === selectedTierId}
              onClick={() =>
                void updateMembership(isMember ? "change_tier" : "join")
              }
            >
              {working ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <HeartHandshake aria-hidden="true" />
              )}
              {working
                ? "Updating…"
                : isMember
                  ? payload.membership?.tierId === selectedTierId
                    ? `Joined · ${currentTier?.name ?? "Supporter"}`
                    : "Change free tier"
                  : "Join free supporter program"}
            </button>
            {isMember ? (
              <button
                type="button"
                className="is-secondary"
                disabled={working}
                onClick={() => void updateMembership("leave")}
              >
                <DoorOpen aria-hidden="true" /> Leave program
              </button>
            ) : null}
          </div>
        </>
      )}

      <p className="creator-supporter-public-boundary">
        This program is free. Loombus is not charging you or creating creator earnings in Phase 2A.
      </p>
      {message ? <p className="creator-supporter-public-message" role="status">{message}</p> : null}
    </section>
  );
}
