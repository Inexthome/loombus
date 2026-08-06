"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  DoorOpen,
  HeartHandshake,
  Loader2,
  LockKeyhole,
  Plus,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import "./creator-supporter-program-manager.css";

type Tier = {
  id: string;
  name: string;
  description: string;
  benefits: string[];
  roomId: string;
};

type OwnerPayload = {
  canManage: boolean;
  program: {
    enabled: boolean;
    headline: string;
    welcome_message: string;
  } | null;
  tiers: Array<{
    id: string;
    name: string;
    description: string;
    benefits: string[] | null;
    room_id: string | null;
  }>;
  rooms: Array<{ id: string; name: string }>;
  supporters: Array<{
    id: string;
    supporter_id: string;
    tier_id: string | null;
    joined_at: string;
    profile: {
      full_name: string | null;
      username: string | null;
    } | null;
  }>;
  error?: string;
};

const INITIAL_TIER: Tier = {
  id: "new-supporter-tier",
  name: "Supporter",
  description: "Join my supporter community on Loombus.",
  benefits: ["Supporter-only discussions", "Creator updates"],
  roomId: "",
};

function normalizeTier(tier: OwnerPayload["tiers"][number]): Tier {
  return {
    id: tier.id,
    name: tier.name,
    description: tier.description ?? "",
    benefits: Array.isArray(tier.benefits) ? tier.benefits : [],
    roomId: tier.room_id ?? "",
  };
}

export function CreatorSupporterProgramManagerPhase2() {
  const [userId, setUserId] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [headline, setHeadline] = useState("Support my work");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [tiers, setTiers] = useState<Tier[]>([{ ...INITIAL_TIER }]);
  const [rooms, setRooms] = useState<OwnerPayload["rooms"]>([]);
  const [supporters, setSupporters] = useState<OwnerPayload["supporters"]>([]);
  const [futureAudience, setFutureAudience] = useState("public");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    const [{ data: userData }, accessToken] = await Promise.all([
      supabase.auth.getUser(),
      token(),
    ]);
    const user = userData.user;
    if (!user || !accessToken) {
      window.location.href = "/login?next=/profile?section=creator";
      return;
    }
    setUserId(user.id);
    const [response, audienceResult] = await Promise.all([
      fetch("/api/creator/supporter-program", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }),
      supabase
        .from("discussion_audience_preferences")
        .select("default_audience_type")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    const result = (await response.json().catch(() => ({}))) as OwnerPayload;
    if (!response.ok) {
      setMessage(result.error ?? "Unable to load the supporter program.");
      setLoading(false);
      return;
    }
    setCanManage(Boolean(result.canManage));
    setEnabled(Boolean(result.program?.enabled));
    setHeadline(result.program?.headline ?? "Support my work");
    setWelcomeMessage(result.program?.welcome_message ?? "");
    setTiers(result.tiers.length ? result.tiers.map(normalizeTier) : [{ ...INITIAL_TIER }]);
    setRooms(result.rooms ?? []);
    setSupporters(result.supporters ?? []);
    setFutureAudience(
      audienceResult.data?.default_audience_type === "supporters"
        ? "supporters"
        : "public"
    );
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tierById = useMemo(
    () => new Map(tiers.map((tier) => [tier.id, tier])),
    [tiers]
  );

  function updateTier(index: number, changes: Partial<Tier>) {
    setTiers((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, ...changes } : tier
      )
    );
  }

  async function saveProgram() {
    if (!canManage || working) return;
    if (tiers.some((tier) => tier.name.trim().length < 2)) {
      setMessage("Every supporter tier needs a name.");
      return;
    }
    setWorking("save");
    setMessage("");
    const accessToken = await token();
    if (!accessToken) return;
    const response = await fetch("/api/creator/supporter-program", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        enabled,
        headline,
        welcomeMessage,
        tiers: tiers.map((tier) => ({
          id: tier.id.startsWith("new-") || tier.id === "new-supporter-tier" ? null : tier.id,
          name: tier.name,
          description: tier.description,
          benefits: tier.benefits,
          roomId: tier.roomId || null,
        })),
      }),
    });
    const result = (await response.json().catch(() => ({}))) as OwnerPayload;
    setWorking("");
    if (!response.ok) {
      setMessage(result.error ?? "Unable to save the supporter program.");
      return;
    }
    setEnabled(Boolean(result.program?.enabled));
    setTiers(result.tiers.map(normalizeTier));
    setRooms(result.rooms ?? []);
    setSupporters(result.supporters ?? []);
    setMessage("Supporter program saved. Pricing settings are managed below.");
  }

  async function saveAudience(next: "public" | "supporters") {
    if (!userId || working) return;
    if (next === "supporters" && !enabled) {
      setMessage("Enable and save the supporter program first.");
      return;
    }
    setWorking("audience");
    const { error } = await supabase.from("discussion_audience_preferences").upsert(
      {
        user_id: userId,
        default_audience_type: next,
        default_audience_base: null,
        include_user_ids: [],
        exclude_user_ids: [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    setWorking("");
    if (error) {
      setMessage(error.message);
      return;
    }
    setFutureAudience(next);
    setMessage(
      next === "supporters"
        ? "Future text Discussions will be visible to active free or paid supporters."
        : "Future Discussions will be Public."
    );
  }

  async function removeSupporter(supporterId: string) {
    if (!userId || working) return;
    setWorking(supporterId);
    setMessage("");
    const accessToken = await token();
    if (!accessToken) return;
    const response = await fetch("/api/creator/supporter-membership", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "remove",
        creatorId: userId,
        supporterId,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setWorking("");
    if (!response.ok) {
      setMessage(result.error ?? "Unable to remove the supporter.");
      return;
    }
    setSupporters((current) =>
      current.filter((supporter) => supporter.supporter_id !== supporterId)
    );
    setMessage(
      result.paidSubscriptionCancelled
        ? "Paid access was cancelled immediately and a manual refund review was queued."
        : "Supporter access removed."
    );
  }

  if (loading) {
    return (
      <section className="creator-supporter-manager is-loading" aria-busy="true">
        <Loader2 className="animate-spin" aria-hidden="true" /> Loading supporter program…
      </section>
    );
  }

  return (
    <section className="creator-supporter-manager">
      <div className="creator-supporter-manager-heading">
        <div>
          <p className="creator-hub-eyebrow">Creator Supporters</p>
          <h3>Manage supporter access and benefits</h3>
          <p>
            Define benefit tiers, supporter-only text Discussions, and optional private Room access. Free or paid pricing for each tier is configured in Paid subscriptions below.
          </p>
        </div>
        <span className={enabled ? "is-active" : ""}>
          <HeartHandshake aria-hidden="true" />
          {enabled ? "Program active" : "Program inactive"}
        </span>
      </div>

      {!canManage ? (
        <div className="creator-supporter-manager-locked">
          <LockKeyhole aria-hidden="true" />
          <div>
            <strong>Premium Plus creator feature</strong>
            <p>Creator supporter programs require Premium Plus.</p>
          </div>
          <Link href="/premium">Review Premium Plus</Link>
        </div>
      ) : (
        <>
          <div className="creator-supporter-program-fields">
            <label className="creator-supporter-switch-row">
              <span>
                <strong>Enable supporter program</strong>
                <small>
                  Programs with active paid subscriptions must be reconciled before shutdown.
                </small>
              </span>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
            </label>
            <label>
              <span>Public headline</span>
              <input
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                maxLength={80}
              />
            </label>
            <label>
              <span>Welcome message</span>
              <textarea
                value={welcomeMessage}
                onChange={(event) => setWelcomeMessage(event.target.value)}
                maxLength={500}
                rows={3}
              />
            </label>
          </div>

          <div className="creator-supporter-tier-heading">
            <div>
              <strong>Benefit tiers</strong>
              <small>Up to four tiers. Configure pricing after saving tier content.</small>
            </div>
            <button
              type="button"
              disabled={tiers.length >= 4}
              onClick={() =>
                setTiers((current) => [
                  ...current,
                  {
                    id: `new-${Date.now()}`,
                    name: `Supporter tier ${current.length + 1}`,
                    description: "",
                    benefits: [],
                    roomId: "",
                  },
                ])
              }
            >
              <Plus aria-hidden="true" /> Add tier
            </button>
          </div>

          <div className="creator-supporter-tier-list">
            {tiers.map((tier, index) => (
              <article key={tier.id}>
                <div className="creator-supporter-tier-number">
                  <span>{index + 1}</span>
                  {tiers.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Remove ${tier.name}`}
                      onClick={() =>
                        setTiers((current) =>
                          current.filter((_, tierIndex) => tierIndex !== index)
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <label>
                  <span>Tier name</span>
                  <input
                    value={tier.name}
                    onChange={(event) => updateTier(index, { name: event.target.value })}
                    maxLength={40}
                  />
                </label>
                <label>
                  <span>Description</span>
                  <textarea
                    value={tier.description}
                    onChange={(event) =>
                      updateTier(index, { description: event.target.value })
                    }
                    rows={2}
                    maxLength={300}
                  />
                </label>
                <label>
                  <span>Benefits, one per line</span>
                  <textarea
                    value={tier.benefits.join("\n")}
                    onChange={(event) =>
                      updateTier(index, {
                        benefits: event.target.value
                          .split("\n")
                          .map((value) => value.trim())
                          .filter(Boolean)
                          .slice(0, 8),
                      })
                    }
                    rows={4}
                  />
                </label>
                <label>
                  <span>Optional private Room access</span>
                  <select
                    value={tier.roomId}
                    onChange={(event) => updateTier(index, { roomId: event.target.value })}
                  >
                    <option value="">No linked Room</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </label>
              </article>
            ))}
          </div>

          <div className="creator-supporter-save-row">
            <button
              type="button"
              disabled={Boolean(working)}
              onClick={() => void saveProgram()}
            >
              {working === "save" ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              Save supporter program
            </button>
            {message ? <p role="status">{message}</p> : null}
          </div>

          <div className="creator-supporter-exclusive-control">
            <div>
              <LockKeyhole aria-hidden="true" />
              <span>
                <strong>Future creator Discussion visibility</strong>
                <small>
                  Supporter-only Discussions remain text-only until Discussion media uses private storage.
                </small>
              </span>
            </div>
            <div role="group" aria-label="Future creator Discussion visibility">
              <button
                type="button"
                className={futureAudience === "public" ? "is-selected" : ""}
                disabled={Boolean(working)}
                onClick={() => void saveAudience("public")}
              >
                {futureAudience === "public" ? <Check aria-hidden="true" /> : null}
                Public
              </button>
              <button
                type="button"
                className={futureAudience === "supporters" ? "is-selected" : ""}
                disabled={Boolean(working) || !enabled}
                onClick={() => void saveAudience("supporters")}
              >
                {futureAudience === "supporters" ? <Check aria-hidden="true" /> : null}
                Supporters
              </button>
            </div>
          </div>

          <div className="creator-supporter-list-heading">
            <div>
              <Users aria-hidden="true" />
              <span>
                <strong>{supporters.length} active supporters</strong>
                <small>Free and paid access is managed through the same entitlement layer.</small>
              </span>
            </div>
            <Link href="/create">
              Create supporter content <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>

          {supporters.length ? (
            <div className="creator-supporter-member-list">
              {supporters.map((supporter) => (
                <article key={supporter.id}>
                  <div>
                    <strong>
                      {supporter.profile?.full_name ||
                        supporter.profile?.username ||
                        "Loombus supporter"}
                    </strong>
                    <small>
                      {tierById.get(supporter.tier_id ?? "")?.name ?? "Supporter"} · joined{" "}
                      {new Date(supporter.joined_at).toLocaleDateString()}
                    </small>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(working)}
                    onClick={() => void removeSupporter(supporter.supporter_id)}
                  >
                    {working === supporter.supporter_id ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <DoorOpen aria-hidden="true" />
                    )}
                    Remove
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="creator-supporter-empty">
              <HeartHandshake aria-hidden="true" />
              <p>Active supporters will appear here after they join.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
