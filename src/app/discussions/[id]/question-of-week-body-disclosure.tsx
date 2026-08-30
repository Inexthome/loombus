"use client";

import { ChevronDown } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase/client";
import styles from "./question-of-week-body-disclosure.module.css";

const BODY_ID = "qotw-editorial-context";

export default function QuestionOfWeekBodyDisclosure() {
  const params = useParams<{ id: string }>();
  const discussionId = String(params?.id ?? "").trim();
  const [isQuestionOfWeek, setIsQuestionOfWeek] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);

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
        console.error("Unable to determine Question of the Week presentation:", error.message);
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

    let mountedHost: HTMLDivElement | null = null;
    let mountedBody: HTMLElement | null = null;
    let observer: MutationObserver | null = null;

    function mountDisclosure() {
      const opening = document.getElementById("discussion-opening");
      const openingBody = opening?.querySelector<HTMLElement>(".discussion-v2-opening-body");
      if (!opening || !openingBody || mountedHost) return false;

      const nextHost = document.createElement("div");
      nextHost.className = styles.host;
      opening.insertBefore(nextHost, openingBody);

      openingBody.id = BODY_ID;
      openingBody.hidden = true;

      mountedHost = nextHost;
      mountedBody = openingBody;
      setHost(nextHost);
      setBody(openingBody);
      return true;
    }

    if (!mountDisclosure()) {
      observer = new MutationObserver(() => {
        if (mountDisclosure()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      if (mountedBody) {
        mountedBody.hidden = false;
        if (mountedBody.id === BODY_ID) mountedBody.removeAttribute("id");
      }
      mountedHost?.remove();
      setHost(null);
      setBody(null);
      setExpanded(false);
    };
  }, [isQuestionOfWeek]);

  useEffect(() => {
    if (body) body.hidden = !expanded;
  }, [body, expanded]);

  if (!isQuestionOfWeek || !host) return null;

  return createPortal(
    <button
      type="button"
      className={styles.button}
      aria-expanded={expanded}
      aria-controls={BODY_ID}
      onClick={() => setExpanded((value) => !value)}
    >
      <span className={styles.copy}>
        <span className={styles.label}>Why this question now &amp; research context</span>
        <span className={styles.hint}>
          {expanded ? "Hide the editorial reasoning and sources." : "Read the editorial reasoning, context, and sources."}
        </span>
      </span>
      <ChevronDown
        aria-hidden="true"
        size={20}
        className={`${styles.icon}${expanded ? ` ${styles.iconExpanded}` : ""}`}
      />
    </button>,
    host
  );
}
