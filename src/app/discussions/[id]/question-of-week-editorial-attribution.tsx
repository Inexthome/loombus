"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase/client";
import styles from "./question-of-week-editorial-attribution.module.css";

const EDITORIAL_NAME = "Loombus Editorial";
const EDITORIAL_MARK = "/assets/brand/loombus-mark-256.png";

function EditorialIdentity() {
  return (
    <span className="discussion-v2-author-identity" aria-label={EDITORIAL_NAME}>
      <span className={styles.mark} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={EDITORIAL_MARK} alt="" />
      </span>
      <span className="discussion-v2-author-copy">
        <span className="discussion-v2-author-name">{EDITORIAL_NAME}</span>
      </span>
    </span>
  );
}

export default function QuestionOfWeekEditorialAttribution() {
  const params = useParams<{ id: string }>();
  const discussionId = String(params?.id ?? "").trim();
  const [isQuestionOfWeek, setIsQuestionOfWeek] = useState(false);
  const [openingHost, setOpeningHost] = useState<HTMLSpanElement | null>(null);
  const [starterHost, setStarterHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkQuestionOfWeek() {
      if (!discussionId) return;

      const { data, error } = await supabase
        .from("questions_of_the_week")
        .select("discussion_id")
        .eq("discussion_id", discussionId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error("Unable to determine Question of the Week attribution:", error.message);
        return;
      }

      setIsQuestionOfWeek(Boolean(data?.discussion_id));
    }

    void checkQuestionOfWeek();
    return () => {
      cancelled = true;
    };
  }, [discussionId]);

  useEffect(() => {
    if (!isQuestionOfWeek) return;

    let mountedOpeningHost: HTMLSpanElement | null = null;
    let mountedStarterHost: HTMLDivElement | null = null;
    let authorIdentity: HTMLElement | null = null;
    let verifiedIdentity: HTMLElement | null = null;
    const hiddenStarterNodes: HTMLElement[] = [];
    let observer: MutationObserver | null = null;

    function mountOpeningAttribution() {
      if (mountedOpeningHost) return true;
      const opening = document.getElementById("discussion-opening");
      const openingMeta = opening?.querySelector<HTMLElement>(".discussion-v2-opening-meta");
      const currentAuthor = openingMeta?.querySelector<HTMLElement>(".discussion-v2-author-identity");
      if (!openingMeta || !currentAuthor) return false;

      const nextHost = document.createElement("span");
      nextHost.className = styles.host;
      nextHost.dataset.qotwEditorialOpening = "true";
      openingMeta.insertBefore(nextHost, currentAuthor);

      authorIdentity = currentAuthor;
      authorIdentity.hidden = true;

      verifiedIdentity = openingMeta.querySelector<HTMLElement>(".discussion-v2-verified-label");
      if (verifiedIdentity) verifiedIdentity.hidden = true;

      mountedOpeningHost = nextHost;
      setOpeningHost(nextHost);
      return true;
    }

    function mountStarterAttribution() {
      if (mountedStarterHost) return true;

      const starterCard = Array.from(
        document.querySelectorAll<HTMLElement>(".discussion-v2-right-rail .discussion-v2-side-card")
      ).find((section) =>
        section.querySelector<HTMLElement>(".discussion-v2-rail-label")?.textContent?.trim().toLowerCase() === "started by"
      );
      if (!starterCard) return false;

      const label = starterCard.querySelector<HTMLElement>(".discussion-v2-rail-label");
      if (!label) return false;

      for (const child of Array.from(starterCard.children)) {
        if (child === label || !(child instanceof HTMLElement)) continue;
        child.hidden = true;
        hiddenStarterNodes.push(child);
      }

      const nextHost = document.createElement("div");
      nextHost.className = styles.host;
      nextHost.dataset.qotwEditorialStarter = "true";
      starterCard.appendChild(nextHost);

      mountedStarterHost = nextHost;
      setStarterHost(nextHost);
      return true;
    }

    function mountAttribution() {
      const openingMounted = mountOpeningAttribution();
      const starterMounted = mountStarterAttribution();
      return openingMounted && starterMounted;
    }

    if (!mountAttribution()) {
      observer = new MutationObserver(() => {
        if (mountAttribution()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      if (authorIdentity) authorIdentity.hidden = false;
      if (verifiedIdentity) verifiedIdentity.hidden = false;
      for (const node of hiddenStarterNodes) node.hidden = false;
      mountedOpeningHost?.remove();
      mountedStarterHost?.remove();
      setOpeningHost(null);
      setStarterHost(null);
    };
  }, [isQuestionOfWeek]);

  if (!isQuestionOfWeek) return null;

  return (
    <>
      {openingHost ? createPortal(<EditorialIdentity />, openingHost) : null}
      {starterHost
        ? createPortal(
            <>
              <EditorialIdentity />
              <p className="discussion-v2-side-copy">
                Loombus Editorial presents this Question of the Week for community discussion.
              </p>
            </>,
            starterHost
          )
        : null}
    </>
  );
}
