"use client";

import { supabase } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DesktopNotificationsTray } from "./desktop-notifications-tray";

const DESKTOP_NOTIFICATION_BUTTON_SELECTOR =
  '.loombus-desktop-flat-topbar [aria-label^="Notifications"]';

type TrayPosition = {
  top: number;
  right: number;
};

export function DesktopNotificationsTrayController() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TrayPosition | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);

  const syncUnreadBadge = useCallback(async (targetUserId: string | null) => {
    const button = document.querySelector<HTMLElement>(DESKTOP_NOTIFICATION_BUTTON_SELECTOR);
    if (!button || !targetUserId) return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetUserId)
      .is("read_at", null);
    const unreadCount = count ?? 0;
    button.dataset.unreadCount = unreadCount > 99 ? "99+" : String(unreadCount);
    button.setAttribute("aria-label", unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications");
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const nextUserId = data.user?.id ?? null;
      setUserId(nextUserId);
      void syncUnreadBadge(nextUserId);
    }

    void loadUser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const nextUserId = session?.user?.id ?? null;
      setUserId(nextUserId);
      void syncUnreadBadge(nextUserId);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncUnreadBadge]);

  useEffect(() => {
    function handleChanged() {
      void syncUnreadBadge(userId);
    }
    window.addEventListener("loombus:notifications-changed", handleChanged);
    return () => window.removeEventListener("loombus:notifications-changed", handleChanged);
  }, [syncUnreadBadge, userId]);

  useEffect(() => {
    setOpen(false);
    setPosition(null);
  }, [pathname]);

  useEffect(() => {
    function getNotificationButton() {
      return document.querySelector<HTMLElement>(DESKTOP_NOTIFICATION_BUTTON_SELECTOR);
    }

    function syncExpandedState(nextOpen: boolean) {
      const button = getNotificationButton();
      if (button) button.setAttribute("aria-expanded", String(nextOpen));
    }

    function syncTrayPosition(button = getNotificationButton()) {
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const notificationButton = target?.closest<HTMLElement>(DESKTOP_NOTIFICATION_BUTTON_SELECTOR);

      if (notificationButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        syncTrayPosition(notificationButton);
        setOpen((current) => {
          const next = !current;
          syncExpandedState(next);
          if (!next) setPosition(null);
          return next;
        });
        return;
      }

      if (open && !trayRef.current?.contains(target as Node)) {
        setOpen(false);
        setPosition(null);
        syncExpandedState(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !open) return;
      setOpen(false);
      setPosition(null);
      syncExpandedState(false);
      getNotificationButton()?.focus();
    }

    function handleViewportChange() {
      if (open) syncTrayPosition();
    }

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    syncExpandedState(open);
    if (open) syncTrayPosition();

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  if (!open || !userId || !position) return null;

  return (
    <div
      ref={trayRef}
      className="fixed z-[170] hidden md:block"
      style={{ top: position.top, right: position.right }}
    >
      <DesktopNotificationsTray
        userId={userId}
        onUnreadCountChange={(count) => {
          const button = document.querySelector<HTMLElement>(DESKTOP_NOTIFICATION_BUTTON_SELECTOR);
          if (!button) return;
          button.dataset.unreadCount = count > 99 ? "99+" : String(count);
          button.setAttribute("aria-label", count > 0 ? `Notifications, ${count} unread` : "Notifications");
        }}
        onClose={() => {
          setOpen(false);
          setPosition(null);
        }}
      />
    </div>
  );
}
