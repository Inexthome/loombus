"use client";

import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type FollowRequester = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type FollowRequestItem = {
  id: string;
  createdAt: string;
  requester: FollowRequester;
};

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function requesterName(requester: FollowRequester) {
  return requester.full_name?.trim() || requester.username || "Loombus member";
}

export default function FollowRequestActions() {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [requests, setRequests] = useState<FollowRequestItem[]>([]);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let slot: HTMLDivElement | null = null;

    function attachSlot() {
      if (slot?.isConnected) return true;
      const tabs = document.querySelector<HTMLElement>(".notifications-v2-tabs");
      if (!tabs?.parentElement) return false;

      slot = document.createElement("div");
      slot.className = "notifications-follow-requests-slot";
      tabs.insertAdjacentElement("afterend", slot);
      setMountNode(slot);
      return true;
    }

    if (!attachSlot()) {
      const observer = new MutationObserver(() => {
        if (attachSlot()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => {
        observer.disconnect();
        slot?.remove();
      };
    }

    return () => slot?.remove();
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadRequests() {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) return;

        const response = await fetch("/api/follows/requests", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        if (!response.ok) return;

        const payload = (await response.json().catch(() => ({}))) as {
          requests?: FollowRequestItem[];
        };
        if (alive) setRequests(payload.requests ?? []);
      } catch {
        // Follow requests are supplementary to the notifications list.
      }
    }

    void loadRequests();
    return () => {
      alive = false;
    };
  }, []);

  async function respond(requestId: string, action: "accept" | "decline") {
    if (workingId) return;
    setWorkingId(requestId);
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        window.location.href = "/login?next=/notifications";
        return;
      }

      const response = await fetch("/api/follows/requests", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId, action }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to update this follow request.");
      }

      setRequests((current) => current.filter((item) => item.id !== requestId));
      setNotice(action === "accept" ? "Follow request accepted." : "Follow request declined.");
      window.dispatchEvent(new Event("loombus:notifications-changed"));

      // The server removes the matching follow-request notification as part of
      // the decision. Reload so the existing notification client drops its
      // local copy immediately as well.
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update this follow request."
      );
      setWorkingId(null);
    }
  }

  if (!mountNode || requests.length === 0) return null;

  return createPortal(
    <section
      className="border-b border-[var(--loombus-border)] px-1 py-4"
      aria-labelledby="follow-requests-heading"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2
          id="follow-requests-heading"
          className="text-sm font-semibold text-[var(--loombus-text)]"
        >
          Follow requests
        </h2>
        <span className="text-xs text-[var(--loombus-text-muted)]">
          {requests.length} pending
        </span>
      </div>

      <div className="divide-y divide-[var(--loombus-border)]">
        {requests.map((item) => {
          const profileHref = item.requester.username
            ? `/u/${encodeURIComponent(item.requester.username)}`
            : "/people";
          const busy = workingId === item.id;

          return (
            <div
              key={item.id}
              className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"
            >
              <Link
                href={profileHref}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#CBAB5B] focus-visible:ring-offset-2"
              >
                <ProfileAvatar profile={item.requester} size="lg" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[var(--loombus-text)]">
                    {requesterName(item.requester)}
                  </span>
                  {item.requester.username ? (
                    <span className="block truncate text-xs text-[var(--loombus-text-muted)]">
                      @{item.requester.username}
                    </span>
                  ) : null}
                </span>
              </Link>

              <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => void respond(item.id, "decline")}
                  disabled={Boolean(workingId)}
                  className="min-h-9 rounded-md border border-[var(--loombus-border)] px-3 text-sm font-medium text-[var(--loombus-text)] transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => void respond(item.id, "accept")}
                  disabled={Boolean(workingId)}
                  className="min-h-9 rounded-md bg-[#CBAB5B] px-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busy ? "Working…" : "Accept"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {notice ? (
        <p className="mt-2 text-xs text-[var(--loombus-text-muted)]" role="status">
          {notice}
        </p>
      ) : null}
    </section>,
    mountNode
  );
}
