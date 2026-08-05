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

type RoomOption = {
  id: string;
  name: string;
  room_type: string | null;
  subscription_plan: string | null;
};

type Supporter = {
  id: string;
  supporter_id: string;
  tier_id: string | null;
  joined_at: string;
  profile: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
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
  rooms: RoomOption[];
  supporters: Supporter[];
  error?: string;
};

const DEFAULT_TIER: Tier = {
  id: "new-supporter-tier",
  name: "Supporter",
  description: "Join my free supporter community on Loombus.",
  benefits: ["Supporter-only discussions", "Creator updates"],
  roomId: "",
};

function normalizeTier(
  tier: OwnerPayload["tiers"][number],
  index: number
): Tier {
  return {
    id: tier.id || `tier-${index}`,
    name: tier.name ?? "Supporter",
    description: tier.description ?? "",
    benefits: Array.isArray(tier.benefits) ? tier.benefits : [],
    roomId: tier.room_id ?? "",
  };
}

function displayName(supporter: Supporter) {
  return (
    supporter.profile?.full_name?.trim() ||
    supporter.profile?.username?.trim() ||
    "Loombus member"
  );
}

export function CreatorSupporterProgramManager() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [headline, setHeadline] = useState("Support my work");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [tiers, setTiers] = useState<Tier[]>([{ ...DEFAULT_TIER }]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [futureAudience, setFutureAudience] = useState("public");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [audienceSaving, setAudienceSaving] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const [message, setMessage] = useState("");

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadProgram() {
    const [{ data: userResult }, token] = await Promise.all([
      supabase.auth.getUser(),
      getAccessToken(),
    ]);
    const user = userResult.user;

    if (!user || !token) {
      window.location.href = "/login?next=/profile?section=creator";
      return;
    }

    setCurrentUserId(user.id);

    const [programResponse, preferenceResult] = await Promise.all([
      fetch("/api/creator/supporter-program", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }),
      supabase
        .from("discussion_audience_preferences")
        .select("default_audience_type")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    const result = (await programResponse.json().catch(() => ({}))) as OwnerPayload;

    if (!programResponse.ok) {
      setMessage(result.error ?? "Unable to load the supporter program.");
      setLoading(false);
      return;
    }

    setCanManage(Boolean(result.canManage));
    setEnabled(Boolean(result.program?.enabled));
    setHeadline(result.program?.headline ?? "Support my work");
    setWelcomeMessage(result.program?.welcome_message ?? "");
    setTiers(
      result.tiers?.length
        ? result.tiers.map(normalizeTier)
        : [{ ...DEFAULT_TIER }]
    );
    setRooms(result.rooms ?? []);
    setSupporters(result.supporters ?? []);
    setFutureAudience(
      preferenceResult.data?.default_audience_type === "supporters"
        ? "supporters"
        : "public"
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadProgram();
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
    setMessage("");
  }

  function addTier() {
    if (tiers.length >= 4) return;
    setTiers((current) => [
      ...current,
      {
        id: `new-${Date.now()}`,
        name: `Supporter tier ${current.length + 1}`,
        description: "",
        benefits: [],
        roomId: "",
      },
    ]);
  }

  function removeTier(index: number) {
    if (tiers.length <= 1) return;
    setTiers((current) => current.filter((_, tierIndex) => tierIndex !== index));
  }

  async function saveProgram() {
    if (!canManage || saving) return;

    if (tiers.some((tier) => tier.name.trim().length < 2)) {
      setMessage("Every supporter tier needs a name.");
      return;
    }

    setSaving(true);
    setMessage("");
    const token = await getAccessToken();

    if (!token) {
      window.location.href = "/login?next=/profile?section=creator";
      return;
    }

    const response = await fetch("/api/creator/supporter-program", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        enabled,
        headline,
        welcomeMessage,
        tiers: tiers.map((tier) => ({
          id:
            tier.id.startsWith("new-") || tier.id === "new-supporter-tier"
              ? null
              : tier.id,
          name: tier.name,
          description: tier.description,
          benefits: tier.benefits,
          roomId: tier.roomId || null,
        })),
      }),
    });
    const result = (await response.json().catch(() => ({}))) as OwnerPayload;
    setSaving(false);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to save the supporter program.");
      return;
    }

    setEnabled(Boolean(result.program?.enabled));
    setHeadline(result.program?.headline ?? headline);
    setWelcomeMessage(result.program?.welcome_message ?? welcomeMessage);
    setTiers(result.tiers.map(normalizeTier));
    setRooms(result.rooms ?? rooms);
    setSupporters(result.supporters ?? supporters);
    setMessage("Supporter program saved.");
  }

  async function saveFutureAudience(nextAudience: "public" | "supporters") {
    if (!enabled && nextAudience === "supporters") {
      setMessage("Enable and save your supporter program first.");
      return;
    }

    if (!currentUserId) {
      setMessage("Your creator identity could not be verified.");
      return;
    }

    setAudienceSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("discussion_audience_preferences")
      .upsert(
        {
          user_id: currentUserId,
          default_audience_type: nextAudience,
          default_audience_base: null,
          include_user_ids: [],
          exclude_user_ids: [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    setAudienceSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setFutureAudience(nextAudience);
    setMessage(
      nextAudience === "supporters"
        ? "Future discussions will be visible only to active supporters."
        : "Future discussions will be Public."
    );
  }

  async function removeSupporter(supporterId: string) {
    if (removingId || !currentUserId) return;
    setRemovingId(supporterId);
    setMessage("");
    const token = await getAccessToken();

    if (!token) {
      setRemovingId("");
      window.location.href = "/login?next=/profile?section=creator";
      return;
    }

    const response = await fetch("/api/creator/supporter-membership", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "remove",
        creatorId: currentUserId,
        supporterId,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setRemovingId("");

    if (!response.ok) {
      setMessage(result.error ?? "Unable to remove the supporter.");
      return;
    }

    setSupporters((current) =>
      current.filter((supporter) => supporter.supporter_id !== supporterId)
    );
    setMessage("Supporter access removed.");
  }

  if (loading) {
    return (
      <section className="creator-supporter-manager is-loading" aria-busy="true">
        <Loader2 className="animate-spin" aria-hidden="true" />
        Loading supporter program…
      </section>
    );
  }

  return (
    <section className="creator-supporter-manager">
      <div className="creator-supporter-manager-heading">
        <div>
          <p className="creator-hub-eyebrow">Creator Supporters · Phase 2A</p>
          <h3>Build a free supporter community</h3>
          <p>
            Define free benefit tiers, publish supporter-only text Discussions, and optionally connect a tier to a private Room. No payments, earnings, or payouts are active.
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
            <p>
              Creator supporter programs require Premium Plus. Joining a creator’s free program remains free for supporters.
            </p>
          </div>
          <Link href="/premium">Review Premium Plus</Link>
        </div>
      ) : (
        <>
          <div className="creator-supporter-program-fields">
            <label className="creator-supporter-switch-row">
              <span>
                <strong>Enable supporter program</strong>
                <small>Members can join after you save an active program.</small>
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
                placeholder="Support my work"
              />
            </label>
            <label>
              <span>Welcome message</span>
              <textarea
                value={welcomeMessage}
                onChange={(event) => setWelcomeMessage(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Tell supporters what they can expect."
              />
            </label>
          </div>

          <div className="creator-supporter-tier-heading">
            <div>
              <strong>Free benefit tiers</strong>
              <small>Up to four tiers. Phase 2A does not accept prices.</small>
            </div>
            <button type="button" onClick={addTier} disabled={tiers.length >= 4}>
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
                      aria-label={`Remove ${tier.name || `tier ${index + 1}`}`}
                      onClick={() => removeTier(index)}
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
                          .map((benefit) => benefit.trim())
                          .filter(Boolean)
                          .slice(0, 8),
                      })
                    }
                    rows={4}
                    placeholder={"Supporter-only discussions\nMonthly creator update"}
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
                  <small>
                    Joining this tier grants Member access to the selected Room. Existing Room roles are preserved.
                  </small>
                </label>
              </article>
            ))}
          </div>

          <div className="creator-supporter-save-row">
            <button type="button" onClick={() => void saveProgram()} disabled={saving}>
              {saving ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              {saving ? "Saving…" : "Save supporter program"}
            </button>
            {message ? <p role="status">{message}</p> : null}
          </div>

          <div className="creator-supporter-exclusive-control">
            <div>
              <LockKeyhole aria-hidden="true" />
              <span>
                <strong>Future creator Discussion visibility</strong>
                <small>
                  Supporter-only Discussions are database-enforced and text-only until Discussion media moves to private storage.
                </small>
              </span>
            </div>
            <div role="group" aria-label="Future creator Discussion visibility">
              <button
                type="button"
                className={futureAudience === "public" ? "is-selected" : ""}
                disabled={audienceSaving}
                onClick={() => void saveFutureAudience("public")}
              >
                {futureAudience === "public" ? <Check aria-hidden="true" /> : null}
                Public
              </button>
              <button
                type="button"
                className={futureAudience === "supporters" ? "is-selected" : ""}
                disabled={audienceSaving || !enabled}
                onClick={() => void saveFutureAudience("supporters")}
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
                <small>Manage free memberships and linked Room access.</small>
              </span>
            </div>
            <Link href="/create">
              Create supporter content <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>

          {supporters.length ? (
            <div className="creator-supporter-member-list">
              {supporters.map((supporter) => {
                const tier = supporter.tier_id
                  ? tierById.get(supporter.tier_id)
                  : null;
                return (
                  <article key={supporter.id}>
                    <div>
                      <strong>{displayName(supporter)}</strong>
                      <small>
                        {supporter.profile?.username
                          ? `@${supporter.profile.username} · `
                          : ""}
                        {tier?.name ?? "Supporter"} · joined{" "}
                        {new Date(supporter.joined_at).toLocaleDateString()}
                      </small>
                    </div>
                    <button
                      type="button"
                      disabled={removingId === supporter.supporter_id}
                      onClick={() => void removeSupporter(supporter.supporter_id)}
                    >
                      {removingId === supporter.supporter_id ? (
                        <Loader2 className="animate-spin" aria-hidden="true" />
                      ) : (
                        <DoorOpen aria-hidden="true" />
                      )}
                      Remove
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="creator-supporter-empty">
              <HeartHandshake aria-hidden="true" />
              <p>
                Your active supporters will appear here after members join from your public profile.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
