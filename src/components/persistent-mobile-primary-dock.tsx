"use client";

import {
  DoorOpen,
  Inbox,
  LineChart,
  MessageCircle,
  Plus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type MouseEvent, useEffect, useState } from "react";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";
import { supabase } from "@/lib/supabase/client";

type DockItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
};

type MessageConversation = {
  hasUnread?: boolean;
};

type NotificationRow = {
  id: string;
  actor_id: string | null;
  type: string;
  target_type: string;
};

const DOCK_ITEMS: readonly DockItem[] = [
  { href: "/discussions", label: "Discussions", icon: MessageCircle },
  { href: "/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/create", label: "Create", icon: Plus, primary: true },
  {
    href: "/the-floor/discussion",
    label: "The Floor",
    icon: LineChart,
  },
  { href: "/inbox", label: "Inbox", icon: Inbox },
];

function isPathActive(pathname: string, href: string) {
  if (href === "/discussions") {
    return pathname === href || pathname.startsWith("/discussions/");
  }

  if (href === "/rooms") {
    return pathname === href || pathname.startsWith("/rooms/");
  }

  if (href === "/the-floor/discussion") {
    return pathname === "/the-floor" || pathname.startsWith("/the-floor/");
  }

  if (href === "/inbox") {
    return (
      pathname === "/inbox" ||
      pathname.startsWith("/inbox/") ||
      pathname === "/notifications" ||
      pathname.startsWith("/notifications/") ||
      pathname === "/messages" ||
      pathname.startsWith("/messages/")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function composerIsOpen(pathname: string) {
  return (
    pathname === "/create" ||
    document.body.dataset.discussionsCreateOpen === "true" ||
    document.body.dataset.createFocus === "true" ||
    Boolean(document.querySelector("[data-discussions-create-modal]"))
  );
}

function isMessageNotification(notification: NotificationRow) {
  return (
    notification.target_type === "conversation" ||
    notification.type === "new_message" ||
    notification.type === "message_reply"
  );
}

export function PersistentMobilePrimaryDock() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [inboxCount, setInboxCount] = useState(0);
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    document.body.dataset.persistentMobileDock = "true";
    return () => {
      delete document.body.dataset.persistentMobileDock;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let activeUserId: string | null = null;

    async function loadInboxCount(nextUserId: string) {
      const [{ data: sessionData }, blockedIds] = await Promise.all([
        supabase.auth.getSession(),
        getBlockedRelationshipUserIds(supabase, nextUserId),
      ]);

      const { data: notificationRows } = await supabase
        .from("notifications")
        .select("id, actor_id, type, target_type")
        .eq("user_id", nextUserId)
        .is("read_at", null);

      let messageUnreadCount = 0;
      const accessToken = sessionData.session?.access_token;

      if (accessToken) {
        try {
          const response = await fetch("/api/messages/conversations", {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
          });
          const payload = await response.json().catch(() => ({}));

          if (response.ok && Array.isArray(payload.conversations)) {
            messageUnreadCount = (payload.conversations as MessageConversation[]).filter(
              (conversation) => conversation.hasUnread
            ).length;
          }
        } catch {
          messageUnreadCount = 0;
        }
      }

      if (!mounted || activeUserId !== nextUserId) return;

      const notificationUnreadCount = filterBlockedActorNotifications(
        (notificationRows ?? []) as NotificationRow[],
        blockedIds
      ).filter((notification) => !isMessageNotification(notification)).length;

      setInboxCount(notificationUnreadCount + messageUnreadCount);
    }

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const nextUserId = data.user?.id ?? null;

      if (!mounted) return;

      activeUserId = nextUserId;
      setUserId(nextUserId);

      if (!nextUserId) {
        setInboxCount(0);
        return;
      }

      await loadInboxCount(nextUserId);
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      activeUserId = session?.user.id ?? null;
      setUserId(activeUserId);

      if (!activeUserId) {
        setInboxCount(0);
        return;
      }

      void loadInboxCount(activeUserId);
    });

    function refreshInboxCount() {
      if (activeUserId) void loadInboxCount(activeUserId);
    }

    window.addEventListener("loombus:notifications-changed", refreshInboxCount);
    window.addEventListener("loombus:messages-changed", refreshInboxCount);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener(
        "loombus:notifications-changed",
        refreshInboxCount
      );
      window.removeEventListener("loombus:messages-changed", refreshInboxCount);
    };
  }, []);

  useEffect(() => {
    let frame = 0;

    function syncSuppression() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setSuppressed(composerIsOpen(pathname));
      });
    }

    const observer = new MutationObserver(syncSuppression);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-create-focus",
        "data-discussions-create-open",
      ],
    });

    syncSuppression();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pathname]);

  function handleNavigation(
    event: MouseEvent<HTMLAnchorElement>,
    item: DockItem,
    active: boolean
  ) {
    if (!active || item.primary) return;

    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!userId || suppressed) return null;

  return (
    <nav
      className="loombus-persistent-mobile-dock"
      aria-label="Mobile primary navigation"
    >
      <div>
        {DOCK_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isPathActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              data-active={active ? "true" : "false"}
              data-primary={item.primary ? "true" : "false"}
              onClick={(event) => handleNavigation(event, item, active)}
            >
              <span className="loombus-persistent-mobile-dock-icon">
                <Icon aria-hidden="true" size={item.primary ? 25 : 22} strokeWidth={2.1} />
                {item.href === "/inbox" && inboxCount > 0 ? (
                  <span className="loombus-persistent-mobile-dock-badge">
                    {inboxCount > 99 ? "99+" : inboxCount}
                  </span>
                ) : null}
              </span>
              <span className="loombus-persistent-mobile-dock-label">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
