"use client";

import { Bell, BellRing, ChevronDown, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { supabase } from "@/lib/supabase/client";

type FollowRecord = {
  notification_level: "major" | "all_replies";
  notify_status: boolean;
};

function DiscussionFollowControl() {
  const params = useParams();
  const router = useRouter();
  const discussionId = String(params.id ?? "");
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [level, setLevel] = useState<FollowRecord["notification_level"]>("major");
  const [notifyStatus, setNotifyStatus] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!mounted || !user) return;
      setViewerId(user.id);

      const { data } = await supabase
        .from("discussion_follows")
        .select("notification_level, notify_status")
        .eq("user_id", user.id)
        .eq("discussion_id", discussionId)
        .maybeSingle();

      if (!mounted || !data) return;
      const row = data as FollowRecord;
      setFollowing(true);
      setLevel(row.notification_level);
      setNotifyStatus(row.notify_status);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [discussionId]);

  async function requireViewer() {
    if (viewerId) return viewerId;
    const { data } = await supabase.auth.getUser();
    if (data.user?.id) {
      setViewerId(data.user.id);
      return data.user.id;
    }
    router.push(`/login?next=${encodeURIComponent(`/discussions/${discussionId}`)}`);
    return null;
  }

  async function followDiscussion() {
    const userId = await requireViewer();
    if (!userId) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.from("discussion_follows").upsert(
      {
        user_id: userId,
        discussion_id: discussionId,
        notification_level: level,
        notify_status: notifyStatus,
      },
      { onConflict: "user_id,discussion_id" }
    );
    setBusy(false);
    if (error) {
      setMessage("Unable to follow this discussion.");
      return;
    }
    setFollowing(true);
    setMessage("Following this discussion.");
    window.dispatchEvent(new Event("loombus:discussion-follow-changed"));
  }

  async function unfollowDiscussion() {
    const userId = await requireViewer();
    if (!userId) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("discussion_follows")
      .delete()
      .eq("user_id", userId)
      .eq("discussion_id", discussionId);
    setBusy(false);
    if (error) {
      setMessage("Unable to unfollow this discussion.");
      return;
    }
    setFollowing(false);
    setOpen(false);
    setMessage("Discussion unfollowed.");
    window.dispatchEvent(new Event("loombus:discussion-follow-changed"));
  }

  async function savePreferences(nextLevel: FollowRecord["notification_level"], nextStatus: boolean) {
    setLevel(nextLevel);
    setNotifyStatus(nextStatus);
    if (!following) return;
    const userId = await requireViewer();
    if (!userId) return;
    setBusy(true);
    const { error } = await supabase
      .from("discussion_follows")
      .update({ notification_level: nextLevel, notify_status: nextStatus })
      .eq("user_id", userId)
      .eq("discussion_id", discussionId);
    setBusy(false);
    setMessage(error ? "Unable to save notification preferences." : "Notification preferences updated.");
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        disabled={busy}
        onClick={() => (following ? setOpen((value) => !value) : void followDiscussion())}
        className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-[color:var(--loombus-text)] transition hover:bg-[color:var(--loombus-surface-muted)] disabled:opacity-60"
        aria-label={following ? "Following discussion. Open notification preferences." : "Follow discussion"}
        title={following ? "Get meaningful updates when this conversation changes." : "Get meaningful updates when this conversation changes."}
      >
        {following ? <BellRing aria-hidden="true" className="h-4 w-4 text-[#CBAB5B]" /> : <Bell aria-hidden="true" className="h-4 w-4" />}
        <span>{following ? "Following" : "Follow"}</span>
        {following ? <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" /> : null}
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[90] w-[19rem] rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-2xl shadow-black/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Follow discussion</p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--loombus-text)]">Meaningful update notifications</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close follow preferences" className="rounded-full p-1 text-[color:var(--loombus-text-muted)] hover:bg-[color:var(--loombus-surface-muted)]">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <label className="flex cursor-pointer gap-3 rounded-xl border border-[color:var(--loombus-border)] p-3">
              <input type="radio" name="discussion-follow-level" checked={level === "major"} onChange={() => void savePreferences("major", notifyStatus)} />
              <span><strong className="block text-sm text-[color:var(--loombus-text)]">Major updates only</strong><small className="mt-0.5 block leading-5 text-[color:var(--loombus-text-muted)]">Reply activity is grouped so active threads do not become noisy.</small></span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-xl border border-[color:var(--loombus-border)] p-3">
              <input type="radio" name="discussion-follow-level" checked={level === "all_replies"} onChange={() => void savePreferences("all_replies", notifyStatus)} />
              <span><strong className="block text-sm text-[color:var(--loombus-text)]">All replies</strong><small className="mt-0.5 block leading-5 text-[color:var(--loombus-text-muted)]">Notify me when each new reply is added.</small></span>
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[color:var(--loombus-border)] p-3">
              <span><strong className="block text-sm text-[color:var(--loombus-text)]">Status changes</strong><small className="mt-0.5 block leading-5 text-[color:var(--loombus-text-muted)]">Resolved or reopened.</small></span>
              <input type="checkbox" checked={notifyStatus} onChange={(event) => void savePreferences(level, event.target.checked)} />
            </label>
          </div>

          {message ? <p className="mt-3 text-xs text-[color:var(--loombus-text-muted)]" role="status">{message}</p> : null}

          <button type="button" disabled={busy} onClick={() => void unfollowDiscussion()} className="mt-4 text-sm font-medium text-[color:var(--loombus-text-muted)] underline-offset-4 hover:underline disabled:opacity-60">
            Unfollow discussion
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function DiscussionFollowBridge() {
  useEffect(() => {
    let root: Root | null = null;
    let mount: HTMLDivElement | null = null;
    let observer: MutationObserver | null = null;

    function install() {
      const actions = document.querySelector<HTMLElement>(".discussion-v2-opening-actions");
      if (!actions) return false;
      const existing = actions.querySelector<HTMLDivElement>('[data-discussion-follow-mount="true"]');
      if (existing) {
        mount = existing;
        return true;
      }
      mount = document.createElement("div");
      mount.dataset.discussionFollowMount = "true";
      mount.className = "inline-flex";
      actions.insertBefore(mount, actions.firstChild);
      root = createRoot(mount);
      root.render(<DiscussionFollowControl />);
      return true;
    }

    if (!install()) {
      observer = new MutationObserver(() => {
        if (install()) {
          observer?.disconnect();
          observer = null;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      root?.unmount();
      mount?.remove();
    };
  }, []);

  return null;
}
