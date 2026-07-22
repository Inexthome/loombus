"use client";

import { createPortal } from "react-dom";
import {
  Check,
  Globe2,
  LockKeyhole,
  Save,
  Search,
  SlidersHorizontal,
  UserCheck,
  UserMinus,
  UserRoundCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AudienceType =
  | "public"
  | "followers"
  | "connections"
  | "exclude_selected"
  | "selected"
  | "only_me"
  | "custom";

type AudienceBase = "public" | "followers" | "connections";

type AudienceCandidate = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  follows_you: boolean;
  you_follow: boolean;
  is_connection: boolean;
};

type AudiencePreference = {
  default_audience_type: string | null;
  default_audience_base: string | null;
  include_user_ids: unknown;
  exclude_user_ids: unknown;
};

type AudienceOption = {
  type: AudienceType;
  label: string;
  description: string;
  Icon: LucideIcon;
};

const AUDIENCE_OPTIONS: AudienceOption[] = [
  {
    type: "public",
    label: "Public",
    description: "Anyone can find and read future discussions.",
    Icon: Globe2,
  },
  {
    type: "followers",
    label: "Followers",
    description: "Only people who follow you can read them.",
    Icon: UsersRound,
  },
  {
    type: "connections",
    label: "Connections",
    description: "Only people you mutually follow can read them.",
    Icon: UserRoundCheck,
  },
  {
    type: "exclude_selected",
    label: "Don't show to",
    description: "Public except for the people you select.",
    Icon: UserMinus,
  },
  {
    type: "selected",
    label: "Only show to",
    description: "Only the people you select can read them.",
    Icon: UserCheck,
  },
  {
    type: "only_me",
    label: "Only me",
    description: "Future discussions stay private to your account.",
    Icon: LockKeyhole,
  },
  {
    type: "custom",
    label: "Custom",
    description: "Choose a base audience with include and exclude exceptions.",
    Icon: SlidersHorizontal,
  },
];

function isAudienceType(value: unknown): value is AudienceType {
  return [
    "public",
    "followers",
    "connections",
    "exclude_selected",
    "selected",
    "only_me",
    "custom",
  ].includes(String(value));
}

function isAudienceBase(value: unknown): value is AudienceBase {
  return ["public", "followers", "connections"].includes(String(value));
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function candidateName(candidate: AudienceCandidate) {
  return candidate.full_name?.trim() || candidate.username?.trim() || "Loombus member";
}

function candidateRelation(candidate: AudienceCandidate) {
  if (candidate.is_connection) return "Connection";
  if (candidate.follows_you) return "Follows you";
  return "You follow";
}

function createSettingsSlot() {
  const privacyCard = document.querySelector<HTMLElement>("#privacy.settings-v2-card");
  if (!privacyCard) return null;

  const existing = privacyCard.querySelector<HTMLElement>(
    "[data-discussion-audience-settings-slot]"
  );
  if (existing) return existing;

  const slot = document.createElement("div");
  slot.dataset.discussionAudienceSettingsSlot = "true";
  privacyCard.querySelector<HTMLElement>(".settings-v2-card-header")?.after(slot);
  return slot;
}

function CandidatePicker({
  candidates,
  selectedIds,
  onToggle,
  emptyMessage,
}: {
  candidates: AudienceCandidate[];
  selectedIds: Set<string>;
  onToggle: (candidateId: string) => void;
  emptyMessage: string;
}) {
  const [query, setQuery] = useState("");
  const filteredCandidates = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return candidates;

    return candidates.filter((candidate) =>
      [candidate.full_name, candidate.username]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(cleanQuery)
    );
  }, [candidates, query]);

  return (
    <div className="discussion-audience-settings-picker">
      <label className="discussion-audience-settings-search">
        <Search aria-hidden="true" size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your followers and connections"
        />
      </label>

      <div className="discussion-audience-settings-people" role="list">
        {filteredCandidates.length === 0 ? (
          <p className="discussion-audience-settings-empty">{emptyMessage}</p>
        ) : (
          filteredCandidates.map((candidate) => {
            const selected = selectedIds.has(candidate.id);
            return (
              <button
                key={candidate.id}
                type="button"
                className="discussion-audience-settings-person"
                data-selected={selected ? "true" : "false"}
                aria-pressed={selected}
                onClick={() => onToggle(candidate.id)}
              >
                <span className="discussion-audience-settings-avatar" aria-hidden="true">
                  {candidate.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={candidate.avatar_url} alt="" />
                  ) : (
                    candidateName(candidate).slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="discussion-audience-settings-person-copy">
                  <strong>{candidateName(candidate)}</strong>
                  <small>
                    {candidate.username ? `@${candidate.username} · ` : ""}
                    {candidateRelation(candidate)}
                  </small>
                </span>
                <span className="discussion-audience-settings-check" aria-hidden="true">
                  {selected ? <Check size={15} /> : null}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function DiscussionAudienceSettingsBridge() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [capabilityReady, setCapabilityReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audienceType, setAudienceType] = useState<AudienceType>("public");
  const [audienceBase, setAudienceBase] = useState<AudienceBase>("public");
  const [includeIds, setIncludeIds] = useState<Set<string>>(() => new Set());
  const [excludeIds, setExcludeIds] = useState<Set<string>>(() => new Set());
  const [candidates, setCandidates] = useState<AudienceCandidate[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | null = null;

    function locateSlot() {
      const slot = createSettingsSlot();
      if (slot) {
        if (!cancelled) setPortalTarget(slot);
        return;
      }

      attempts += 1;
      if (attempts < 60) timer = window.setTimeout(locateSlot, 120);
    }

    locateSlot();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document
        .querySelector<HTMLElement>("[data-discussion-audience-settings-slot]")
        ?.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAudienceSettings() {
      const { data: userResult } = await supabase.auth.getUser();
      const user = userResult.user;

      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data: capability, error: capabilityError } = await supabase.rpc(
        "get_discussion_audience_capability"
      );
      const ready = capability === true && !capabilityError;

      if (cancelled) return;
      setCapabilityReady(ready);

      if (!ready) {
        setLoading(false);
        return;
      }

      const [preferenceResult, candidateResult] = await Promise.all([
        supabase
          .from("discussion_audience_preferences")
          .select(
            "default_audience_type, default_audience_base, include_user_ids, exclude_user_ids"
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.rpc("get_discussion_audience_candidates"),
      ]);

      if (cancelled) return;

      if (preferenceResult.error) {
        setMessage("Future Discussion visibility could not load.");
        setLoading(false);
        return;
      }

      const preference = (preferenceResult.data ?? null) as AudiencePreference | null;
      setAudienceType(
        isAudienceType(preference?.default_audience_type)
          ? preference.default_audience_type
          : "public"
      );
      setAudienceBase(
        isAudienceBase(preference?.default_audience_base)
          ? preference.default_audience_base
          : "public"
      );
      setIncludeIds(new Set(normalizeIds(preference?.include_user_ids)));
      setExcludeIds(new Set(normalizeIds(preference?.exclude_user_ids)));
      setCandidates((candidateResult.data ?? []) as AudienceCandidate[]);
      setLoading(false);
    }

    void loadAudienceSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedOption =
    AUDIENCE_OPTIONS.find((option) => option.type === audienceType) ??
    AUDIENCE_OPTIONS[0];
  const SelectedIcon = selectedOption.Icon;
  const restricted = audienceType !== "public";

  function chooseAudience(type: AudienceType) {
    setAudienceType(type);
    setMessage("");
  }

  function toggleInclude(candidateId: string) {
    setIncludeIds((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
    setExcludeIds((current) => {
      if (!current.has(candidateId)) return current;
      const next = new Set(current);
      next.delete(candidateId);
      return next;
    });
    setMessage("");
  }

  function toggleExclude(candidateId: string) {
    setExcludeIds((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
    setIncludeIds((current) => {
      if (!current.has(candidateId)) return current;
      const next = new Set(current);
      next.delete(candidateId);
      return next;
    });
    setMessage("");
  }

  async function savePreference() {
    if (!capabilityReady || !userId || saving) return;

    if (audienceType === "selected" && includeIds.size === 0) {
      setMessage("Choose at least one person for Only show to.");
      return;
    }

    if (audienceType === "exclude_selected" && excludeIds.size === 0) {
      setMessage("Choose at least one person for Don't show to.");
      return;
    }

    const savedIncludeIds =
      audienceType === "selected" || audienceType === "custom"
        ? [...includeIds].filter((id) => !excludeIds.has(id)).slice(0, 250)
        : [];
    const savedExcludeIds =
      audienceType === "exclude_selected" || audienceType === "custom"
        ? [...excludeIds].slice(0, 250)
        : [];

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("discussion_audience_preferences")
      .upsert(
        {
          user_id: userId,
          default_audience_type: audienceType,
          default_audience_base: audienceType === "custom" ? audienceBase : null,
          include_user_ids: savedIncludeIds,
          exclude_user_ids: savedExcludeIds,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select(
        "default_audience_type, default_audience_base, include_user_ids, exclude_user_ids"
      )
      .single();

    setSaving(false);

    if (error || !data) {
      setMessage(error?.message || "Unable to save future Discussion visibility.");
      return;
    }

    const saved = data as AudiencePreference;
    setAudienceType(
      isAudienceType(saved.default_audience_type)
        ? saved.default_audience_type
        : "public"
    );
    setAudienceBase(
      isAudienceBase(saved.default_audience_base)
        ? saved.default_audience_base
        : "public"
    );
    setIncludeIds(new Set(normalizeIds(saved.include_user_ids)));
    setExcludeIds(new Set(normalizeIds(saved.exclude_user_ids)));
    setMessage("Future Discussion visibility saved. Existing discussions were not changed.");
  }

  if (!portalTarget) return null;

  return createPortal(
    <section
      className="discussion-audience-settings-panel"
      aria-label="Future Discussion visibility"
    >
      <div className="discussion-audience-settings-heading">
        <div>
          <p className="discussion-audience-settings-eyebrow">
            Future Discussion visibility
          </p>
          <h3>Choose who can see discussions you create in the future.</h3>
          <p>
            This is an account setting, not a Create-page choice. Saving it applies
            automatically to new discussions and does not change existing discussions.
          </p>
        </div>
        <span className="discussion-audience-settings-current">
          <SelectedIcon aria-hidden="true" size={16} />
          {selectedOption.label}
        </span>
      </div>

      {loading ? (
        <div className="discussion-audience-settings-notice">
          Loading visibility settings…
        </div>
      ) : null}

      {!loading && !capabilityReady ? (
        <div className="discussion-audience-settings-notice is-warning">
          The revised Supabase migrations must be applied before this setting can be
          saved. Public remains the only active behavior until then.
        </div>
      ) : null}

      <div className="discussion-audience-settings-options">
        {AUDIENCE_OPTIONS.map(({ type, label, description, Icon }) => {
          const selected = audienceType === type;
          return (
            <button
              key={type}
              type="button"
              disabled={!capabilityReady || saving}
              className="discussion-audience-settings-option"
              data-selected={selected ? "true" : "false"}
              aria-pressed={selected}
              onClick={() => chooseAudience(type)}
            >
              <Icon aria-hidden="true" size={20} />
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <span className="discussion-audience-settings-radio" aria-hidden="true">
                {selected ? <Check size={14} /> : null}
              </span>
            </button>
          );
        })}
      </div>

      {capabilityReady && audienceType === "selected" ? (
        <div className="discussion-audience-settings-detail">
          <div className="discussion-audience-settings-detail-copy">
            <strong>Only these people</strong>
            <span>{includeIds.size} selected</span>
          </div>
          <CandidatePicker
            candidates={candidates}
            selectedIds={includeIds}
            onToggle={toggleInclude}
            emptyMessage="Follow someone or gain a follower before choosing a person."
          />
        </div>
      ) : null}

      {capabilityReady && audienceType === "exclude_selected" ? (
        <div className="discussion-audience-settings-detail">
          <div className="discussion-audience-settings-detail-copy">
            <strong>Hide future discussions from</strong>
            <span>{excludeIds.size} selected</span>
          </div>
          <CandidatePicker
            candidates={candidates}
            selectedIds={excludeIds}
            onToggle={toggleExclude}
            emptyMessage="Follow someone or gain a follower before choosing a person."
          />
        </div>
      ) : null}

      {capabilityReady && audienceType === "custom" ? (
        <div className="discussion-audience-settings-detail">
          <label className="discussion-audience-settings-base">
            <span>Base audience</span>
            <select
              value={audienceBase}
              onChange={(event) =>
                setAudienceBase(
                  isAudienceBase(event.target.value) ? event.target.value : "public"
                )
              }
            >
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="connections">Connections</option>
            </select>
          </label>

          <details className="discussion-audience-settings-exceptions">
            <summary>
              Always show to
              <span>{includeIds.size}</span>
            </summary>
            <CandidatePicker
              candidates={candidates}
              selectedIds={includeIds}
              onToggle={toggleInclude}
              emptyMessage="No connected people are available."
            />
          </details>

          <details className="discussion-audience-settings-exceptions">
            <summary>
              Don't show to
              <span>{excludeIds.size}</span>
            </summary>
            <CandidatePicker
              candidates={candidates}
              selectedIds={excludeIds}
              onToggle={toggleExclude}
              emptyMessage="No connected people are available."
            />
          </details>
        </div>
      ) : null}

      {restricted ? (
        <div className="discussion-audience-settings-notice is-warning">
          Restricted future discussions are text-only in this release because current
          Discussion media uses public storage URLs. Set this to Public before creating
          a discussion with files or Video Context.
        </div>
      ) : null}

      {message ? (
        <div className="discussion-audience-settings-notice">{message}</div>
      ) : null}

      <div className="discussion-audience-settings-savebar">
        <p>Changes affect only discussions created after you save.</p>
        <button
          type="button"
          className="settings-v2-primary-action"
          disabled={!capabilityReady || saving}
          onClick={() => void savePreference()}
        >
          <Save aria-hidden="true" size={16} />
          {saving ? "Saving…" : "Save visibility setting"}
        </button>
      </div>
    </section>,
    portalTarget
  );
}
