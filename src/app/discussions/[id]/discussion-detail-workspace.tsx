"use client";

import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, CircleDot, ExternalLink, SearchCheck, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import "./discussion-detail-workspace.css";

type WorkspaceMode = "state" | "intelligence" | "points" | "evidence" | "reply";

type WorkspaceReply = {
  id: string;
  user_id: string;
  body: string;
  referenced_reply_id: string | null;
  created_at: string;
};

type WorkspaceProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
};

const WORKSPACE_MODES: Array<{ key: WorkspaceMode; label: string }> = [
  { key: "state", label: "State of Discussion" },
  { key: "intelligence", label: "Conversation Intelligence" },
  { key: "points", label: "Points" },
  { key: "evidence", label: "Evidence" },
  { key: "reply", label: "Reply" },
];

const EVIDENCE_REQUEST_PATTERNS = [
  /\bsource\??\b/i,
  /\bevidence\??\b/i,
  /\bcitation\??\b/i,
  /\bproof\??\b/i,
  /\bdata\??\b/i,
  /\bcan you cite\b/i,
  /\bdo you have (?:a |the )?source\b/i,
  /\bwhere (?:did|does) (?:that|this|it) come from\b/i,
  /\bback (?:that|this|it) up\b/i,
  /\bsubstantiate\b/i,
];

function profileName(profile?: WorkspaceProfile) {
  return profile?.full_name?.trim() || (profile?.username ? `@${profile.username}` : "Loombus member");
}

function excerpt(value: string, limit = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit).trimEnd()}…` : normalized;
}

function isEvidenceRequest(body: string) {
  return EVIDENCE_REQUEST_PATTERNS.some((pattern) => pattern.test(body));
}

export default function DiscussionDetailWorkspace() {
  const params = useParams();
  const discussionId = String(params.id ?? "");
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [mainColumn, setMainColumn] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<WorkspaceMode>("state");
  const [replies, setReplies] = useState<WorkspaceReply[]>([]);
  const [profiles, setProfiles] = useState<Record<string, WorkspaceProfile>>({});

  useEffect(() => {
    const column = document.querySelector<HTMLElement>(".discussion-v2-main-column");
    const intelligence = document.querySelector<HTMLElement>(".discussion-v2-intelligence-card");
    if (!column || !intelligence) return;

    const workspaceHost = document.createElement("div");
    workspaceHost.className = "discussion-detail-workspace-host";
    workspaceHost.id = "discussion-workspace";
    intelligence.before(workspaceHost);
    column.dataset.workspaceMode = "state";
    setHost(workspaceHost);
    setMainColumn(column);

    return () => {
      delete column.dataset.workspaceMode;
      workspaceHost.remove();
    };
  }, []);

  useEffect(() => {
    if (!discussionId) return;
    let alive = true;

    void supabase
      .from("replies")
      .select("id,user_id,body,referenced_reply_id,created_at")
      .eq("discussion_id", discussionId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .then(async ({ data }) => {
        if (!alive) return;
        const rows = (data ?? []) as WorkspaceReply[];
        setReplies(rows);

        const profileIds = [...new Set(rows.map((reply) => reply.user_id))];
        if (profileIds.length === 0) {
          setProfiles({});
          return;
        }

        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id,full_name,username")
          .in("id", profileIds);
        if (!alive) return;
        setProfiles(
          Object.fromEntries(
            ((profileRows ?? []) as WorkspaceProfile[]).map((profile) => [profile.id, profile]),
          ),
        );
      });

    return () => {
      alive = false;
    };
  }, [discussionId]);

  const pointRows = useMemo(() => {
    const childCounts = new Map<string, number>();
    for (const reply of replies) {
      if (!reply.referenced_reply_id) continue;
      childCounts.set(reply.referenced_reply_id, (childCounts.get(reply.referenced_reply_id) ?? 0) + 1);
    }

    return replies
      .filter((reply) => !reply.referenced_reply_id || (childCounts.get(reply.id) ?? 0) > 0)
      .map((reply) => ({ reply, childCount: childCounts.get(reply.id) ?? 0 }));
  }, [replies]);

  const evidenceRequests = useMemo(
    () => replies.filter((reply) => isEvidenceRequest(reply.body)),
    [replies],
  );

  function selectConversationMap() {
    const intelligence = document.querySelector<HTMLElement>(".discussion-v2-intelligence-card");
    const buttons = Array.from(
      intelligence?.querySelectorAll<HTMLButtonElement>(".discussion-v2-ai-tabs button") ?? [],
    );
    const conversationMap = buttons.find((button) =>
      button.textContent?.replace(/\s+/g, " ").trim().toLowerCase().includes("conversation map"),
    );
    conversationMap?.click();
  }

  function applyMode(nextMode: WorkspaceMode, shouldScroll = false) {
    if (mainColumn) mainColumn.dataset.workspaceMode = nextMode;
    setMode(nextMode);
    if (nextMode === "intelligence") {
      window.setTimeout(selectConversationMap, 0);
    }
    if (shouldScroll) {
      window.requestAnimationFrame(() => {
        document.getElementById("discussion-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!button) return;
      const label = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";

      if (
        label === "join the discussion" ||
        label === "add your reply" ||
        label === "write the first reply" ||
        (label === "reply" && Boolean(button.closest(".discussion-v2-mobile-bar")))
      ) {
        if (mainColumn) mainColumn.dataset.workspaceMode = "reply";
        setMode("reply");
      } else if (label === "state of discussion") {
        if (mainColumn) mainColumn.dataset.workspaceMode = "state";
        setMode("state");
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [mainColumn]);

  function openReply(replyId: string) {
    document.getElementById(`reply-${replyId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (!host) return null;

  return createPortal(
    <section className="discussion-detail-workspace" aria-label="Discussion workspace">
      <div className="discussion-detail-workspace-tabs" role="tablist" aria-label="Discussion tools">
        {WORKSPACE_MODES.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={mode === item.key}
            className={mode === item.key ? "is-active" : undefined}
            onClick={() => applyMode(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {mode === "intelligence" ? (
        <div className="discussion-detail-workspace-context" role="tabpanel">
          <div>
            <span className="discussion-detail-workspace-kicker">Conversation Intelligence</span>
            <strong>Understand how the conversation is developing.</strong>
          </div>
          <button type="button" onClick={selectConversationMap}>
            <Sparkles aria-hidden="true" size={16} />
            Build intelligence
          </button>
        </div>
      ) : null}

      {mode === "points" ? (
        <div className="discussion-detail-workspace-panel" role="tabpanel">
          <header>
            <div>
              <span className="discussion-detail-workspace-kicker">Points</span>
              <h2>Conversations forming inside the conversation.</h2>
              <p>Open a point to continue in the original thread without duplicating the discussion here.</p>
            </div>
            <CircleDot aria-hidden="true" size={22} />
          </header>

          {pointRows.length > 0 ? (
            <div className="discussion-detail-workspace-list">
              {pointRows.map(({ reply, childCount }) => (
                <button key={reply.id} type="button" onClick={() => openReply(reply.id)}>
                  <span>
                    <strong>{profileName(profiles[reply.user_id])}</strong>
                    <small>{childCount > 0 ? `${childCount} ${childCount === 1 ? "response" : "responses"}` : "Point in the thread"}</small>
                  </span>
                  <p>{excerpt(reply.body)}</p>
                  <ChevronRight aria-hidden="true" size={17} />
                </button>
              ))}
            </div>
          ) : (
            <div className="discussion-detail-workspace-empty">
              <p>No conversation points have formed yet.</p>
              <button type="button" onClick={() => applyMode("reply")}>Add the first signal</button>
            </div>
          )}
        </div>
      ) : null}

      {mode === "evidence" ? (
        <div className="discussion-detail-workspace-panel" role="tabpanel">
          <header>
            <div>
              <span className="discussion-detail-workspace-kicker">Evidence</span>
              <h2>Responses asking others to substantiate a point.</h2>
              <p>This view surfaces direct requests for sources, evidence, citations, proof, or supporting data already present in the thread.</p>
            </div>
            <SearchCheck aria-hidden="true" size={22} />
          </header>

          {evidenceRequests.length > 0 ? (
            <div className="discussion-detail-workspace-list">
              {evidenceRequests.map((reply) => (
                <button key={reply.id} type="button" onClick={() => openReply(reply.id)}>
                  <span>
                    <strong>{profileName(profiles[reply.user_id])}</strong>
                    <small>Evidence request</small>
                  </span>
                  <p>{excerpt(reply.body)}</p>
                  <ExternalLink aria-hidden="true" size={16} />
                </button>
              ))}
            </div>
          ) : (
            <div className="discussion-detail-workspace-empty">
              <p>No direct evidence requests are visible in this conversation yet.</p>
              <button type="button" onClick={() => applyMode("reply")}>Ask for evidence</button>
            </div>
          )}
        </div>
      ) : null}
    </section>,
    host,
  );
}
