"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";

type SafetyNotification = {
  id: string;
  type: string;
  target_type: string;
  target_id: string | null;
  room_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
};

type SafetyAction = SafetyNotification & {
  href: string;
  label: string;
};

const SAFETY_NOTIFICATION_TYPES = [
  "age_correction_submitted",
  "age_correction_status",
  "underage_account_report",
  "underage_account_report_status",
  "room_join_request_review",
];

function actionForNotification(
  notification: SafetyNotification,
  isAdmin: boolean
): SafetyAction | null {
  if (notification.type === "age_correction_submitted") {
    return isAdmin
      ? { ...notification, href: "/admin/age-safety", label: "Review age correction" }
      : null;
  }

  if (notification.type === "underage_account_report") {
    return isAdmin
      ? { ...notification, href: "/admin/age-safety", label: "Review underage report" }
      : null;
  }

  if (
    notification.type === "age_correction_status" ||
    notification.type === "underage_account_report_status"
  ) {
    return {
      ...notification,
      href: "/account/age-safety",
      label: "Open age safety",
    };
  }

  if (notification.type === "room_join_request_review" && notification.room_id) {
    return {
      ...notification,
      href: `/rooms/${encodeURIComponent(notification.room_id)}`,
      label: "Open Room",
    };
  }

  return null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function TeenSafetyNotificationDestinations() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [actions, setActions] = useState<SafetyAction[]>([]);

  useEffect(() => {
    let cancelled = false;
    let scheduled = false;

    const findHost = () => {
      scheduled = false;
      const shell = document.querySelector<HTMLElement>(".notifications-v2-shell");
      if (!shell) return;

      let destination = shell.querySelector<HTMLElement>(
        "[data-loombus-teen-safety-notification-actions='true']"
      );
      if (!destination) {
        destination = document.createElement("div");
        destination.dataset.loombusTeenSafetyNotificationActions = "true";
        const actionsSection = shell.querySelector(".notifications-v2-actions");
        if (actionsSection) shell.insertBefore(destination, actionsSection);
        else shell.appendChild(destination);
      }

      if (!cancelled) setHost(destination);
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(findHost);
    };

    findHost();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      const current = document.querySelector<HTMLElement>(
        "[data-loombus-teen-safety-notification-actions='true']"
      );
      current?.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profile }, { data: rows, error }] = await Promise.all([
        supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("notifications")
          .select(
            "id, type, target_type, target_id, room_id, message, read_at, created_at"
          )
          .eq("user_id", user.id)
          .in("type", SAFETY_NOTIFICATION_TYPES)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (!alive || error) return;
      const isAdmin = profile?.is_admin === true;
      const mapped = ((rows ?? []) as SafetyNotification[])
        .map((notification) => actionForNotification(notification, isAdmin))
        .filter((notification): notification is SafetyAction => Boolean(notification))
        .slice(0, 6);
      setActions(mapped);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const unreadCount = useMemo(
    () => actions.filter((notification) => !notification.read_at).length,
    [actions]
  );

  async function markRead(notification: SafetyAction) {
    if (notification.read_at) return;
    const readAt = new Date().toISOString();
    await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", notification.id)
      .is("read_at", null);
    setActions((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read_at: readAt } : item
      )
    );
    window.dispatchEvent(new Event("loombus:notifications-changed"));
  }

  if (!host || actions.length === 0) return null;

  return createPortal(
    <section
      aria-label="Age-safety and Room admission actions"
      style={{
        marginBottom: "1rem",
        border: "1px solid var(--loombus-border)",
        borderRadius: "1.25rem",
        background: "var(--loombus-surface)",
        color: "var(--loombus-text)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              color: "var(--loombus-muted-text)",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Protected actions
          </p>
          <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.15rem" }}>
            Age safety and Room admission
          </h2>
        </div>
        <span
          style={{
            border: "1px solid var(--loombus-border)",
            borderRadius: "999px",
            padding: "0.35rem 0.65rem",
            color: "var(--loombus-muted-text)",
            fontSize: "0.78rem",
          }}
        >
          {unreadCount} unread
        </span>
      </div>

      <div style={{ display: "grid", gap: "0.65rem" }}>
        {actions.map((notification) => (
          <article
            key={notification.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              border: "1px solid var(--loombus-border)",
              borderRadius: "1rem",
              background: "var(--loombus-surface-strong)",
              padding: "0.8rem",
            }}
          >
            <div style={{ minWidth: 0, flex: "1 1 16rem" }}>
              <p style={{ margin: 0, lineHeight: 1.5 }}>
                {normalizePublicText(notification.message)}
              </p>
              <small style={{ color: "var(--loombus-muted-text)" }}>
                {formatDate(notification.created_at)}
                {!notification.read_at ? " · New" : ""}
              </small>
            </div>
            <Link
              href={notification.href}
              onClick={() => void markRead(notification)}
              style={{
                borderRadius: "999px",
                background: "#CBAB5B",
                color: "#111111",
                fontWeight: 700,
                padding: "0.65rem 0.9rem",
                textDecoration: "none",
              }}
            >
              {notification.label}
            </Link>
          </article>
        ))}
      </div>
    </section>,
    host
  );
}
