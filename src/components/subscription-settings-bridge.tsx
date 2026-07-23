"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isIosNativeApp } from "@/lib/native-app";
import { supabase } from "@/lib/supabase/client";

type SubscriptionItem = {
  id: string;
  scope: "membership" | "room";
  label: string;
  planLabel: string;
  provider: "stripe" | "apple" | "admin" | "included" | "none";
  status: string;
  subscriptionId: string | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canManage: boolean;
  roomIds: string[];
  roomNames: string[];
  memberLimit: number | null;
};

type SubscriptionPayload = {
  membership?: SubscriptionItem;
  roomSubscriptions?: SubscriptionItem[];
  recurringCount?: number;
  error?: string;
};

type PortalAction = "manage" | "cancel" | "update";

type CdvPurchaseWindow = Window & {
  CdvPurchase?: {
    store?: {
      manageSubscriptions?: () => Promise<void> | void;
    };
  };
};

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

async function openAppleSubscriptions() {
  const store = (window as CdvPurchaseWindow).CdvPurchase?.store;
  if (store?.manageSubscriptions) {
    await store.manageSubscriptions();
    return true;
  }
  return false;
}

function formatStatus(value: string) {
  if (value === "trialing") return "Trial";
  if (value === "past_due") return "Past due";
  if (value === "incomplete_expired") return "Expired";
  if (value === "free") return "Free";
  if (value === "admin") return "Admin access";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatPrice(item: SubscriptionItem) {
  if (item.amount === null || !item.currency) {
    if (item.provider === "admin" || item.provider === "included") return "Included";
    if (item.provider === "none") return "$0";
    return "Price unavailable";
  }
  const amount = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: item.currency.toUpperCase(),
  }).format(item.amount / 100);
  return item.interval ? `${amount} / ${item.interval}` : amount;
}

function providerLabel(provider: SubscriptionItem["provider"]) {
  if (provider === "stripe") return "Stripe";
  if (provider === "apple") return "Apple App Store";
  if (provider === "admin") return "Loombus admin";
  if (provider === "included") return "Included access";
  return "No paid provider";
}

function isActiveStatus(status: string) {
  return ["active", "trialing", "past_due"].includes(status);
}

function SubscriptionCard({
  item,
  working,
  onPortal,
}: {
  item: SubscriptionItem;
  working: string;
  onPortal: (item: SubscriptionItem, action: PortalAction) => void;
}) {
  const actionKey = (action: PortalAction) => `${item.id}:${action}`;
  const stripeSubscription = item.provider === "stripe" && Boolean(item.subscriptionId);
  const appleSubscription = item.provider === "apple";
  const canChange =
    stripeSubscription && isActiveStatus(item.status) && !item.cancelAtPeriodEnd;
  const canCancel =
    (stripeSubscription || appleSubscription) &&
    isActiveStatus(item.status) &&
    !item.cancelAtPeriodEnd;

  return (
    <article className="settings-subscription-card">
      <div className="settings-subscription-card-top">
        <div className="settings-subscription-icon">
          {item.scope === "membership" ? (
            <Sparkles aria-hidden="true" />
          ) : (
            <CreditCard aria-hidden="true" />
          )}
        </div>
        <div className="settings-subscription-title">
          <span>{item.scope === "membership" ? "Loombus plan" : "Room subscription"}</span>
          <h3>{item.label}</h3>
          <p>{item.planLabel}</p>
        </div>
        <span
          className={`settings-subscription-status${
            item.cancelAtPeriodEnd ? " is-canceling" : ""
          }`}
        >
          {item.cancelAtPeriodEnd ? "Cancellation scheduled" : formatStatus(item.status)}
        </span>
      </div>

      <div className="settings-subscription-facts">
        <div>
          <span>Price</span>
          <strong>{formatPrice(item)}</strong>
        </div>
        <div>
          <span>Billing provider</span>
          <strong>{providerLabel(item.provider)}</strong>
        </div>
        <div>
          <span>{item.cancelAtPeriodEnd ? "Access ends" : "Next renewal"}</span>
          <strong>{formatDate(item.currentPeriodEnd)}</strong>
        </div>
        {item.scope === "room" ? (
          <div>
            <span>Member limit</span>
            <strong>{item.memberLimit === null ? "Custom" : item.memberLimit}</strong>
          </div>
        ) : null}
      </div>

      {item.roomNames.length > 1 ? (
        <div className="settings-subscription-room-list">
          <strong>Included Rooms</strong>
          <span>{item.roomNames.join(", ")}</span>
        </div>
      ) : null}

      {item.cancelAtPeriodEnd ? (
        <div className="settings-subscription-alert">
          <CalendarDays aria-hidden="true" />
          <span>
            This subscription remains active through {formatDate(item.currentPeriodEnd)}.
            Open billing management to review or reactivate it.
          </span>
        </div>
      ) : null}

      <div className="settings-subscription-actions">
        {item.scope === "membership" && item.provider === "none" ? (
          <Link href="/premium" className="settings-v2-primary-action">
            View Premium options <ArrowUpRight aria-hidden="true" />
          </Link>
        ) : null}

        {item.scope === "room" && item.roomIds[0] ? (
          <Link
            href={`/rooms/${item.roomIds[0]}`}
            className="settings-v2-secondary-action"
          >
            Open Room <ExternalLink aria-hidden="true" />
          </Link>
        ) : null}

        {canChange ? (
          <button
            type="button"
            className="settings-v2-primary-action"
            disabled={Boolean(working)}
            onClick={() => onPortal(item, "update")}
          >
            {working === actionKey("update") ? "Opening…" : "Change plan"}
            <ArrowUpRight aria-hidden="true" />
          </button>
        ) : null}

        {(stripeSubscription || appleSubscription) ? (
          <button
            type="button"
            className="settings-v2-secondary-action"
            disabled={Boolean(working)}
            onClick={() => onPortal(item, "manage")}
          >
            {working === actionKey("manage") ? "Opening…" : "Manage billing"}
            <CreditCard aria-hidden="true" />
          </button>
        ) : null}

        {canCancel ? (
          <button
            type="button"
            className="settings-subscription-cancel-action"
            disabled={Boolean(working)}
            onClick={() => onPortal(item, "cancel")}
          >
            {working === actionKey("cancel") ? "Opening…" : "Cancel subscription"}
            <XCircle aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function SubscriptionCenter() {
  const [payload, setPayload] = useState<SubscriptionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const token = await getAccessToken();
      if (!token) {
        window.location.href = "/login?next=/settings?section=plan";
        return;
      }
      const response = await fetch("/api/settings/subscriptions", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as SubscriptionPayload;
      if (!response.ok) {
        setMessage(result.error ?? "Unable to load subscriptions.");
        return;
      }
      setPayload(result);
    } catch {
      setMessage("Unable to load subscriptions. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "returned") {
      setMessage("Billing management completed. Subscription details are refreshing.");
    }
  }, [load]);

  const items = useMemo(() => {
    if (!payload?.membership) return [];
    return [payload.membership, ...(payload.roomSubscriptions ?? [])];
  }, [payload]);

  async function openPortal(item: SubscriptionItem, action: PortalAction) {
    const key = `${item.id}:${action}`;
    if (working) return;
    setWorking(key);
    setMessage("");

    if (item.provider === "apple") {
      try {
        const opened = isIosNativeApp() ? await openAppleSubscriptions() : false;
        setMessage(
          opened
            ? "Apple subscription management opened."
            : "Open your Apple ID subscriptions to change or cancel this plan."
        );
      } catch {
        setMessage("Open your Apple ID subscriptions to change or cancel this plan.");
      } finally {
        setWorking("");
      }
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        window.location.href = "/login?next=/settings?section=plan";
        return;
      }
      const response = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          subscriptionId: item.subscriptionId,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) {
        setMessage(result.error ?? "Unable to open billing management.");
        return;
      }
      window.location.href = result.url;
    } catch {
      setMessage("Unable to open billing management. Try again.");
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="settings-subscription-center">
      <div className="settings-v2-card-header settings-subscription-heading">
        <div>
          <p className="settings-v2-eyebrow">Subscriptions</p>
          <h2>Everything you subscribe to on Loombus.</h2>
          <p>
            Review your Loombus plan and paid Rooms in one place. Stripe and Apple
            remain the secure providers for payment methods, invoices, plan changes,
            and cancellation.
          </p>
        </div>
        <span className="settings-v2-badge">
          <CreditCard aria-hidden="true" /> {payload?.recurringCount ?? 0} recurring
        </span>
      </div>

      {message ? <div className="settings-v2-notice">{message}</div> : null}

      {loading ? (
        <div className="settings-subscription-loading">
          <RefreshCw aria-hidden="true" />
          <span>Checking current subscriptions…</span>
        </div>
      ) : items.length ? (
        <div className="settings-subscription-list">
          {items.map((item) => (
            <SubscriptionCard
              key={item.id}
              item={item}
              working={working}
              onPortal={(entry, action) => void openPortal(entry, action)}
            />
          ))}
        </div>
      ) : (
        <div className="settings-v2-section-note">No subscription information is available.</div>
      )}

      <div className="settings-subscription-footer">
        <div>
          <CheckCircle2 aria-hidden="true" />
          <span>
            Cancellation does not remove access immediately when the provider schedules
            it for the end of the paid period.
          </span>
        </div>
        <button
          type="button"
          className="settings-v2-quiet-button"
          disabled={loading}
          onClick={() => void load()}
        >
          <RotateCcw aria-hidden="true" /> Refresh subscriptions
        </button>
      </div>
    </div>
  );
}

export function SubscriptionSettingsBridge() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let slot: HTMLElement | null = null;
    let originalChildren: HTMLElement[] = [];

    const renameNavigation = () => {
      document
        .querySelectorAll<HTMLButtonElement>(".settings-workspace-nav button")
        .forEach((button) => {
          const label = button.querySelector("span");
          if (label?.textContent?.trim() === "Plan") label.textContent = "Subscriptions";
        });
    };

    const observer = new MutationObserver(renameNavigation);
    observer.observe(document.body, { childList: true, subtree: true });
    renameNavigation();

    function prepare() {
      const plan = document.getElementById("plan");
      if (!plan) {
        attempts += 1;
        if (!cancelled && attempts < 80) window.setTimeout(prepare, 100);
        return;
      }

      originalChildren = Array.from(plan.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement
      );
      originalChildren.forEach((child) => {
        child.hidden = true;
      });

      slot = document.createElement("div");
      slot.dataset.subscriptionSettingsSlot = "true";
      plan.appendChild(slot);
      setTarget(slot);
    }

    prepare();
    return () => {
      cancelled = true;
      observer.disconnect();
      originalChildren.forEach((child) => {
        child.hidden = false;
      });
      slot?.remove();
    };
  }, []);

  return target ? createPortal(<SubscriptionCenter />, target) : null;
}
