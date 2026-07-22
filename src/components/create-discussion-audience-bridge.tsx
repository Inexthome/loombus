"use client";

import { createPortal } from "react-dom";
import {
  Check,
  Globe2,
  LockKeyhole,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AudienceType =
  | "public"
  | "followers"
  | "connections"
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

type AudienceDraft = {
  type: AudienceType;
  base: AudienceBase;
  includeIds: string[];
  excludeIds: string[];
  capabilityReady: boolean;
};

const AUDIENCE_OPTIONS: Array<{
  type: AudienceType;
  label: string;
  description: string;
  Icon: typeof Globe2;
}> = [
  {
    type: "public",
    label: "Public",
    description: "Anyone can find and read it.",
    Icon: Globe2,
  },
  {
    type: "followers",
    label: "Followers",
    description: "Only people who follow you.",
    Icon: UsersRound,
  },
  {
    type: "connections",
    label: "Connections",
    description: "Only mutual follows.",
    Icon: UserRoundCheck,
  },
  {
    type: "selected",
    label: "Selected people",
    description: "Only people you choose.",
    Icon: UserCheck,
  },
  {
    type: "only_me",
    label: "Only me",
    description: "A private discussion for you.",
    Icon: LockKeyhole,
  },
  {
    type: "custom",
    label: "Custom",
    description: "Choose a base audience and exceptions.",
    Icon: SlidersHorizontal,
  },
];

const DEFAULT_DRAFT: AudienceDraft = {
  type: "public",
  base: "public",
  includeIds: [],
  excludeIds: [],
  capabilityReady: false,
};

function isAudienceType(value: unknown): value is AudienceType {
  return ["public", "followers", "connections", "selected", "only_me", "custom"].includes(
    String(value)
  );
}

function isAudienceBase(value: unknown): value is AudienceBase {
  return ["public", "followers", "connections"].includes(String(value));
}

function candidateName(candidate: AudienceCandidate) {
  return candidate.full_name?.trim() || candidate.username?.trim() || "Loombus member";
}

function candidateRelation(candidate: AudienceCandidate) {
  if (candidate.is_connection) return "Connection";
  if (candidate.follows_you) return "Follows you";
  return "You follow";
}

function jsonResponse(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hasStagedDiscussionAttachments() {
  const videoInput = document.querySelector<HTMLInputElement>(
    'main form input[type="file"][accept="video/*"]'
  );
  const contextSection = videoInput?.closest("section");
  return Boolean(contextSection?.querySelector('button[aria-label^="Remove "]'));
}

function setAttachmentControlsRestricted(restricted: boolean) {
  const videoInput = document.querySelector<HTMLInputElement>(
    'main form input[type="file"][accept="video/*"]'
  );
  const contextSection = videoInput?.closest<HTMLElement>("section");
  if (!contextSection) return;

  contextSection.dataset.audienceRestricted = restricted ? "true" : "false";
  const actionGrid = contextSection.querySelector<HTMLElement>(":scope > div.mt-4.grid");
  const buttons = actionGrid?.querySelectorAll<HTMLButtonElement>(":scope > button") ?? [];

  buttons.forEach((button) => {
    button.disabled = restricted;
    button.title = restricted
      ? "Attachments currently require a Public audience because Discussion media uses public storage."
      : "";
  });
}

function createAudienceSlot() {
  const form = document.querySelector("main form");
  if (!form) return null;

  const modeLabel = Array.from(form.querySelectorAll("p")).find((element) =>
    element.textContent?.trim().startsWith("Discussion Mode")
  );
  const modeBlock = modeLabel?.parentElement;
  if (!modeBlock) return null;

  const existing = form.querySelector<HTMLElement>("[data-discussion-audience-slot]");
  if (existing) return existing;

  const slot = document.createElement("div");
  slot.dataset.discussionAudienceSlot = "true";
  modeBlock.before(slot);
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
  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return candidates;
    return candidates.filter((candidate) =>
      [candidate.full_name, candidate.username]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(clean)
    );
  }, [candidates, query]);

  return (
    <div className="discussion-audience-picker">
      <label className="discussion-audience-search">
        <Search aria-hidden="true" size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your followers and connections"
        />
      </label>

      <div className="discussion-audience-people" role="list">
        {filtered.length === 0 ? (
          <p className="discussion-audience-empty">{emptyMessage}</p>
        ) : (
          filtered.map((candidate) => {
            const selected = selectedIds.has(candidate.id);
            return (
              <button
                key={candidate.id}
                type="button"
                className="discussion-audience-person"
                data-selected={selected ? "true" : "false"}
                aria-pressed={selected}
                onClick={() => onToggle(candidate.id)}
              >
                <span className="discussion-audience-avatar" aria-hidden="true">
                  {candidate.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={candidate.avatar_url} alt="" />
                  ) : (
                    candidateName(candidate).slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="discussion-audience-person-copy">
                  <strong>{candidateName(candidate)}</strong>
                  <small>
                    {candidate.username ? `@${candidate.username} · ` : ""}
                    {candidateRelation(candidate)}
                  </small>
                </span>
                <span className="discussion-audience-check" aria-hidden="true">
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

export function CreateDiscussionAudienceBridge() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [capabilityReady, setCapabilityReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audienceType, setAudienceType] = useState<AudienceType>("public");
  const [audienceBase, setAudienceBase] = useState<AudienceBase>("public");
  const [includeIds, setIncludeIds] = useState<Set<string>>(() => new Set());
  const [excludeIds, setExcludeIds] = useState<Set<string>>(() => new Set());
  const [candidates, setCandidates] = useState<AudienceCandidate[]>([]);
  const [defaultStatus, setDefaultStatus] = useState("");
  const payloadRef = useRef<AudienceDraft>(DEFAULT_DRAFT);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | null = null;

    function locateSlot() {
      const slot = createAudienceSlot();
      if (slot) {
        if (!cancelled) setPortalTarget(slot);
        return;
      }
      attempts += 1;
      if (attempts < 30) timer = window.setTimeout(locateSlot, 120);
    }

    locateSlot();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      const slot = document.querySelector<HTMLElement>("[data-discussion-audience-slot]");
      slot?.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAudienceControls() {
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
        setAudienceType("public");
        setLoading(false);
        return;
      }

      const [{ data: preference }, { data: candidateRows }] = await Promise.all([
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

      const localKey = `loombus:create:audience:${user.id}`;
      let savedDraft: Partial<AudienceDraft> | null = null;
      try {
        const stored = window.localStorage.getItem(localKey);
        savedDraft = stored ? (JSON.parse(stored) as Partial<AudienceDraft>) : null;
      } catch {
        savedDraft = null;
      }

      const sourceType = savedDraft?.type ?? preference?.default_audience_type;
      const sourceBase = savedDraft?.base ?? preference?.default_audience_base;
      const sourceInclude = savedDraft?.includeIds ?? preference?.include_user_ids;
      const sourceExclude = savedDraft?.excludeIds ?? preference?.exclude_user_ids;

      setAudienceType(isAudienceType(sourceType) ? sourceType : "public");
      setAudienceBase(isAudienceBase(sourceBase) ? sourceBase : "public");
      setIncludeIds(
        new Set(Array.isArray(sourceInclude) ? sourceInclude.filter((id) => typeof id === "string") : [])
      );
      setExcludeIds(
        new Set(Array.isArray(sourceExclude) ? sourceExclude.filter((id) => typeof id === "string") : [])
      );
      setCandidates((candidateRows ?? []) as AudienceCandidate[]);
      setLoading(false);
    }

    void loadAudienceControls();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const draft: AudienceDraft = {
      type: audienceType,
      base: audienceBase,
      includeIds: [...includeIds],
      excludeIds: [...excludeIds],
      capabilityReady,
    };
    payloadRef.current = draft;

    if (userId && !loading) {
      try {
        window.localStorage.setItem(
          `loombus:create:audience:${userId}`,
          JSON.stringify(draft)
        );
      } catch {
        // Local draft persistence is optional.
      }
    }

    setAttachmentControlsRestricted(audienceType !== "public");
    return () => setAttachmentControlsRestricted(false);
  }, [audienceBase, audienceType, capabilityReady, excludeIds, includeIds, loading, userId]);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const inputUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      let pathname = inputUrl;
      try {
        pathname = new URL(inputUrl, window.location.origin).pathname;
      } catch {
        // Keep the original value when URL parsing fails.
      }

      const method = String(init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (pathname === "/api/discussions/create" && method === "POST" && typeof init?.body === "string") {
        const audience = payloadRef.current;

        if (audience.type !== "public" && !audience.capabilityReady) {
          return jsonResponse(
            "Discussion audience controls require the new privacy migration before a restricted discussion can be published.",
            503
          );
        }

        if (audience.type === "selected" && audience.includeIds.length === 0) {
          return jsonResponse("Choose at least one person for Selected people.", 400);
        }

        if (audience.type !== "public" && hasStagedDiscussionAttachments()) {
          return jsonResponse(
            "Remove staged attachments before publishing a restricted discussion. Attachments currently require a Public audience.",
            400
          );
        }

        try {
          const body = JSON.parse(init.body) as Record<string, unknown>;
          const existingMetadata =
            body.discussionMetadata &&
            typeof body.discussionMetadata === "object" &&
            !Array.isArray(body.discussionMetadata)
              ? (body.discussionMetadata as Record<string, unknown>)
              : {};

          body.discussionMetadata = {
            ...existingMetadata,
            __audience_type: audience.type,
            ...(audience.type === "custom" ? { __audience_base: audience.base } : {}),
            ...(["selected", "custom"].includes(audience.type)
              ? { __audience_include_ids: audience.includeIds.join(",") }
              : {}),
            ...(audience.type === "custom"
              ? { __audience_exclude_ids: audience.excludeIds.join(",") }
              : {}),
          };

          const response = await originalFetch(input, { ...init, body: JSON.stringify(body) });
          if (response.ok && userId) {
            try {
              window.localStorage.removeItem(`loombus:create:audience:${userId}`);
            } catch {
              // Local draft cleanup is optional.
            }
          }
          return response;
        } catch {
          return originalFetch(input, init);
        }
      }

      return originalFetch(input, init);
    };

    window.fetch = wrappedFetch;
    return () => {
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    };
  }, [userId]);

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
  }

  async function saveAsDefault() {
    if (!userId || !capabilityReady) return;
    if (audienceType === "selected" && includeIds.size === 0) {
      setDefaultStatus("Choose at least one person before saving this default.");
      return;
    }

    setDefaultStatus("Saving default...");
    const { error } = await supabase.from("discussion_audience_preferences").upsert(
      {
        user_id: userId,
        default_audience_type: audienceType,
        default_audience_base: audienceType === "custom" ? audienceBase : null,
        include_user_ids: ["selected", "custom"].includes(audienceType) ? [...includeIds] : [],
        exclude_user_ids: audienceType === "custom" ? [...excludeIds] : [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    setDefaultStatus(error ? "The default audience could not be saved." : "Default audience saved.");
  }

  if (!portalTarget) return null;

  return createPortal(
    <section className="discussion-audience-panel" aria-labelledby="discussion-audience-title">
      <div className="discussion-audience-heading">
        <div>
          <p className="discussion-audience-eyebrow">Privacy and reach</p>
          <h2 id="discussion-audience-title">Who can see this discussion?</h2>
          <p>Audience access is enforced across feeds, search, notifications, direct links, and replies.</p>
        </div>
        <ShieldCheck aria-hidden="true" size={22} />
      </div>

      {loading ? (
        <p className="discussion-audience-loading">Loading your audience choices...</p>
      ) : (
        <>
          {!capabilityReady ? (
            <div className="discussion-audience-migration-notice">
              Public remains active until the discussion audience migration is applied.
            </div>
          ) : null}

          <div className="discussion-audience-options" role="radiogroup" aria-label="Discussion audience">
            {AUDIENCE_OPTIONS.map((option) => {
              const selected = audienceType === option.type;
              const disabled = !capabilityReady && option.type !== "public";
              return (
                <button
                  key={option.type}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  className="discussion-audience-option"
                  data-selected={selected ? "true" : "false"}
                  onClick={() => {
                    setAudienceType(option.type);
                    setDefaultStatus("");
                  }}
                >
                  <option.Icon aria-hidden="true" size={20} />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                  <span className="discussion-audience-radio" aria-hidden="true">
                    {selected ? <Check size={14} /> : null}
                  </span>
                </button>
              );
            })}
          </div>

          {audienceType === "selected" ? (
            <div className="discussion-audience-detail-panel">
              <div className="discussion-audience-detail-copy">
                <strong>Only show to</strong>
                <span>{includeIds.size} selected</span>
              </div>
              <CandidatePicker
                candidates={candidates}
                selectedIds={includeIds}
                onToggle={toggleInclude}
                emptyMessage="No matching followers or connections are available yet."
              />
            </div>
          ) : null}

          {audienceType === "custom" ? (
            <div className="discussion-audience-detail-panel">
              <label className="discussion-audience-base">
                <span>Start with</span>
                <select
                  value={audienceBase}
                  onChange={(event) => setAudienceBase(event.target.value as AudienceBase)}
                >
                  <option value="public">Public</option>
                  <option value="followers">Followers</option>
                  <option value="connections">Connections</option>
                </select>
              </label>

              <details className="discussion-audience-exceptions">
                <summary>
                  Also show to selected people
                  <span>{includeIds.size}</span>
                </summary>
                <CandidatePicker
                  candidates={candidates}
                  selectedIds={includeIds}
                  onToggle={toggleInclude}
                  emptyMessage="No matching followers or connections are available yet."
                />
              </details>

              <details className="discussion-audience-exceptions">
                <summary>
                  Do not show to
                  <span>{excludeIds.size}</span>
                </summary>
                <CandidatePicker
                  candidates={candidates}
                  selectedIds={excludeIds}
                  onToggle={toggleExclude}
                  emptyMessage="No matching followers or connections are available yet."
                />
              </details>
            </div>
          ) : null}

          {audienceType !== "public" ? (
            <p className="discussion-audience-attachment-note">
              Restricted discussions currently support text only. Remove staged files or Video Context before publishing.
            </p>
          ) : null}

          <div className="discussion-audience-footer">
            <button
              type="button"
              className="discussion-audience-default-button"
              disabled={!capabilityReady}
              onClick={() => void saveAsDefault()}
            >
              <Save aria-hidden="true" size={16} />
              Use this for future discussions
            </button>
            {defaultStatus ? <span>{defaultStatus}</span> : null}
          </div>
        </>
      )}
    </section>,
    portalTarget
  );
}
