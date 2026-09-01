"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase/client";
import styles from "./question-of-week-editorial-attribution.module.css";

const EDITORIAL_NAME = "Loombus Editorial";
const EDITORIAL_MARK = "/assets/brand/loombus-mark-256.png";

export default function QuestionOfWeekEditorialAttribution() {
  const params = useParams<{ id: string }>();
  const discussionId = String(params?.id ?? "").trim();
  const [isQuestionOfWeek, setIsQuestionOfWeek] = useState(false);
  const [host, setHost] = useState<HTMLSpanElement | null>(null);

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

    let mountedHost: HTMLSpanElement | null = null;
    let authorIdentity: HTMLElement | null = null;
    let verifiedIdentity: HTMLElement | null = null;
    let observer: MutationObserver | null = null;

    function mountAttribution() {
      const opening = document.getElementById("discussion-opening");
      const openingMeta = opening?.querySelector<HTMLElement>(".discussion-v2-opening-meta");
      const currentAuthor = openingMeta?.querySelector<HTMLElement>(".discussion-v2-author-identity");
      if (!openingMeta || !currentAuthor || mountedHost) return false;

      const nextHost = document.createElement("span");
      nextHost.className = styles.host;
      openingMeta.insertBefore(nextHost, currentAuthor);

      authorIdentity = currentAuthor;
      authorIdentity.hidden = true;

      verifiedIdentity = openingMeta.querySelector<HTMLElement>(".discussion-v2-verified-label");
      if (verifiedIdentity) verifiedIdentity.hidden = true;

      mountedHost = nextHost;
      setHost(nextHost);
      return true;
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
      mountedHost?.remove();
      setHost(null);
    };
  }, [isQuestionOfWeek]);

  if (!isQuestionOfWeek || !host) return null;

  return createPortal(
    <span className="discussion-v2-author-identity" aria-label={EDITORIAL_NAME}>
      <span className={styles.mark} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={EDITORIAL_MARK} alt="" />
      </span>
      <span className="discussion-v2-author-copy">
        <span className="discussion-v2-author-name">{EDITORIAL_NAME}</span>
      </span>
    </span>,
    host
  );
}
