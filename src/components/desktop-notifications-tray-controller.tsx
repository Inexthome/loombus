"use client";

import { supabase } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DesktopNotificationsTray } from "./desktop-notifications-tray";

const DESKTOP_NOTIFICATION_BUTTON_SELECTOR =
  '.loombus-desktop-top-navbar button[aria-label="Notifications"]';

/**
 * Owns the desktop notification-bell interaction while the top navigation
 * remains responsible for its unread badge. Keeping the tray controller
 * separate lets the full-page and compact notification experiences evolve
 * without expanding the already-large navigation component.
 */
export function DesktopNotificationsTrayController() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const trayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (mounted) setUserId(data.user?.id ?? null);
    }

    void loadUser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function syncExpandedState(nextOpen: boolean) {
      const button = document.querySelector<HTMLButtonElement>(
        DESKTOP_NOTIFICATION_BUTTON_SELECTOR,
      );
      if (button) button.setAttribute("aria-expanded", String(nextOpen));
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const notificationButton = target?.closest<HTMLButtonElement>(
        DESKTOP_NOTIFICATION_BUTTON_SELECTOR,
      );

      if (notificationButton) {
        // Capture the desktop bell before the legacy mini-menu handler. The
        // compact tray below is now the single desktop notification surface.
        event.preventDefault();
        event.stopPropagation();
        setOpen((current) => {
          const next = !current;
          syncExpandedState(next);
          return next;
        });
        return;
      }

      if (open && !trayRef.current?.contains(target as Node)) {
        setOpen(false);
        syncExpandedState(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !open) return;
      setOpen(false);
      syncExpandedState(false);
      document
        .querySelector<HTMLButtonElement>(DESKTOP_NOTIFICATION_BUTTON_SELECTOR)
        ?.focus();
    }

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("keydown", handleEscape);
    syncExpandedState(open);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!open || !userId) return null;

  return (
    <div
      ref={trayRef}
      className="fixed right-6 top-[4.85rem] z-[170] hidden md:block"
    >
      <DesktopNotificationsTray
        userId={userId}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
