"use client";

import { createPortal } from "react-dom";
import {
  Globe2,
  HeartHandshake,
  LockKeyhole,
  SlidersHorizontal,
  UserCheck,
  UserMinus,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import styles from "./discussion-audience-detail-badge.module.css";

type AudienceType =
  | "public"
  | "followers"
  | "supporters"
  | "connections"
  | "exclude_selected"
  | "selected"
  | "only_me"
  | "custom";

type AudienceBase = "public" | "followers" | "connections";

type AudienceRow = {
  audience_type: string | null;
  audience_base: string | null;
};

const LABELS: Record<AudienceType, string> = {
  public: "Public",
  followers: "Followers",
  supporters: "Supporters",
  connections: "Connections",
  exclude_selected: "Don't show to",
  selected: "Only show to",
  only_me: "Only me",
  custom: "Custom audience",
};

const ICONS: Record<AudienceType, typeof Globe2> = {
  public: Globe2,
  followers: UsersRound,
  supporters: HeartHandshake,
  connections: UserRoundCheck,
  exclude_selected: UserMinus,
  selected: UserCheck,
  only_me: LockKeyhole,
  custom: SlidersHorizontal,
};

const AUDIENCE_TYPES = new Set<AudienceType>(Object.keys(LABELS) as AudienceType[]);
const AUDIENCE_BASES = new Set<AudienceBase>(["public", "followers", "connections"]);

function normalizeAudienceType(value: unknown): AudienceType {
  const normalized = String(value ?? "").trim() as AudienceType;
  return AUDIENCE_TYPES.has(normalized) ? normalized : "public";
}

function normalizeAudienceBase(value: unknown): AudienceBase | null {
  const normalized = String(value ?? "").trim() as AudienceBase;
  return AUDIENCE_BASES.has(normalized) ? normalized : null;
}

function createAudienceBadgeSlot() {
  const topicRow = document.querySelector<HTMLElement>(
    ".discussion-v2-opening-card .discussion-v2-topic-row"
  );
  if (!topicRow) return null;

  const existing = topicRow.querySelector<HTMLElement>(
    "[data-discussion-audience-badge-slot]"
  );
  if (existing) return existing;

  const slot = document.createElement("span");
  slot.dataset.discussionAudienceBadgeSlot = "true";
  topicRow.append(slot);
  return slot;
}

export function DiscussionAudienceDetailBadge() {
  const params = useParams();
  const discussionId = String(params.id ?? "");
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [audience, setAudience] = useState<AudienceRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | null = null;

    function locate() {
      const slot = createAudienceBadgeSlot();
      if (slot) {
        if (!cancelled) setPortalTarget(slot);
        return;
      }

      attempts += 1;
      if (attempts < 30) timer = window.setTimeout(locate, 120);
    }

    locate();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document
        .querySelector<HTMLElement>("[data-discussion-audience-badge-slot]")
        ?.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAudience() {
      if (!discussionId) return;
      const { data, error } = await supabase
        .from("discussions")
        .select("audience_type, audience_base")
        .eq("id", discussionId)
        .maybeSingle();

      if (!cancelled && !error && data) setAudience(data as AudienceRow);
    }

    void loadAudience();
    return () => {
      cancelled = true;
    };
  }, [discussionId]);

  if (!portalTarget || !audience) return null;

  const type = normalizeAudienceType(audience.audience_type);
  const base = normalizeAudienceBase(audience.audience_base);
  const Icon = ICONS[type];
  const customBase = type === "custom" && base ? ` · ${LABELS[base]}` : "";

  return createPortal(
    <span className={styles.badge} title={`Audience: ${LABELS[type]}${customBase}`}>
      <Icon aria-hidden="true" size={14} />
      {LABELS[type]}
    </span>,
    portalTarget
  );
}
