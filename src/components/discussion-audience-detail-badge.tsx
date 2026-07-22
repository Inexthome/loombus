"use client";

import { createPortal } from "react-dom";
import {
  Globe2,
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

type AudienceType =
  | "public"
  | "followers"
  | "connections"
  | "exclude_selected"
  | "selected"
  | "only_me"
  | "custom";

type AudienceRow = {
  audience_type: AudienceType | null;
  audience_base: "public" | "followers" | "connections" | null;
};

const LABELS: Record<AudienceType, string> = {
  public: "Public",
  followers: "Followers",
  connections: "Connections",
  exclude_selected: "Don't show to",
  selected: "Only show to",
  only_me: "Only me",
  custom: "Custom audience",
};

const ICONS = {
  public: Globe2,
  followers: UsersRound,
  connections: UserRoundCheck,
  exclude_selected: UserMinus,
  selected: UserCheck,
  only_me: LockKeyhole,
  custom: SlidersHorizontal,
};

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

  const type = audience.audience_type ?? "public";
  const Icon = ICONS[type];
  const customBase =
    type === "custom" && audience.audience_base
      ? ` · ${LABELS[audience.audience_base]}`
      : "";

  return createPortal(
    <span
      className="discussion-audience-detail-badge"
      title={`Audience: ${LABELS[type]}${customBase}`}
    >
      <Icon aria-hidden="true" size={14} />
      {LABELS[type]}
    </span>,
    portalTarget
  );
}
