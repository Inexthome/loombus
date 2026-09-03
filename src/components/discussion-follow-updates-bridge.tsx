"use client";

import Link from "next/link";
import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { supabase } from "@/lib/supabase/client";
import { normalizePublicText } from "@/lib/public-text";

type FollowNotification = {
  id: string;
  target_id: string | null;
  message: string;
  created_at: string;
  read_at: string | null;
};

type DiscussionTitle = {
  id: string;
  title: string;
};

type UpdateItem = {
  id: string;
  discussionId: string;
  title: string;
  message: string;
};

function FollowedDiscussionUpdates() {
  const [items, setItems] = useState<UpdateItem[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) return;

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: notificationRows, error } = await supabase
        .from("notifications")
        .select("id,target_id,message,created_at,read_at")
        .eq("user_id", user.id)
        .eq("type", "followed_discussion")
        .eq("target_type", "discussion")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(12);

      if (!mounted || error) return;
      const notifications = (notificationRows ?? []) as FollowNotification[];
      const ids = [...new Set(notifications.map((row) => row.target_id).filter((id): id is string => Boolean(id)))];
      if (ids.length === 0) {
        setItems([]);
        return;
      }

      const { data: discussionRows } = await supabase
        .from("discussions")
        .select("id,title")
        .in("id", ids)
        .is("deleted_at", null);

      const titles = new Map(((discussionRows ?? []) as DiscussionTitle[]).map((row) => [row.id, row.title]));
      const seen = new Set<string>();
      const next: UpdateItem[] = [];

      for (const notification of notifications) {
        if (!notification.target_id || seen.has(notification.target_id)) continue;
        const title = titles.get(notification.target_id);
        if (!title) continue;
        seen.add(notification.target_id);
        next.push({
          id: notification.id,
          discussionId: notification.target_id,
          title,
          message: notification.message,
        });
        if (next.length >= 3) break;
      }

      if (mounted) setItems(next);
    }

    void load();
    const refresh = () => void load();
    window.addEventListener("loombus:notifications-changed", refresh);
    window.addEventListener("loombus:discussion-follow-changed", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("loombus:notifications-changed", refresh);
      window.removeEventListener("loombus:discussion-follow-changed", refresh);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="mt-4 border-t border-[color:var(--loombus-border-muted)] pt-4" aria-label="Followed discussion updates">
      <div className="flex items-center gap-2">
        <BellRing aria-hidden="true" className="h-4 w-4 text-[#CBAB5B]" />
        <h3 className="text-sm font-semibold text-[color:var(--loombus-text)]">Followed discussions</h3>
      </div>
      <div className="mt-2 divide-y divide-[color:var(--loombus-border-muted)]">
        {items.map((item) => (
          <Link key={item.id} href={`/discussions/${item.discussionId}`} className="group block py-2.5">
            <strong className="line-clamp-1 block text-sm font-semibold text-[color:var(--loombus-text)] group-hover:text-[#CBAB5B]">
              {normalizePublicText(item.title)}
            </strong>
            <span className="mt-0.5 line-clamp-1 block text-xs text-[color:var(--loombus-text-muted)]">
              {item.message}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function DiscussionFollowUpdatesBridge() {
  useEffect(() => {
    let root: Root | null = null;
    let mount: HTMLDivElement | null = null;
    let observer: MutationObserver | null = null;

    function install() {
      const panel = document.querySelector<HTMLElement>('[data-discussions-engagement-mount="true"]');
      if (!panel) return false;
      const existing = panel.querySelector<HTMLDivElement>('[data-discussion-follow-updates-mount="true"]');
      if (existing) {
        mount = existing;
        return true;
      }
      mount = document.createElement("div");
      mount.dataset.discussionFollowUpdatesMount = "true";
      panel.appendChild(mount);
      root = createRoot(mount);
      root.render(<FollowedDiscussionUpdates />);
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
