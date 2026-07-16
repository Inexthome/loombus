"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  ROOM_PLAN_ENTITLEMENTS,
  type RoomPlanKey,
} from "@/lib/room-plan-entitlements";

type IncludedPlanStatus = {
  available: boolean;
  usedRooms: number;
  roomLimit: number | null;
};

type CheckoutConfigResponse = {
  includedPlans?: Partial<Record<RoomPlanKey, IncludedPlanStatus>>;
};

const PLAN_LABELS = Object.values(ROOM_PLAN_ENTITLEMENTS).map((plan) => ({
  id: plan.id,
  label: plan.label,
  features: plan.features,
}));

function findPlanContainer(root: Element, label: string) {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>("button, article")
  );
  return candidates.find((candidate) => {
    const heading = candidate.querySelector("h2, h3");
    return heading?.textContent?.trim() === label;
  });
}

function includedCapacityCopy(status: IncludedPlanStatus) {
  if (!status.available) return null;
  if (status.roomLimit === null) {
    return "An additional Room is included in your active Enterprise subscription";
  }
  const remaining = Math.max(0, status.roomLimit - status.usedRooms);
  return `${remaining} included Room slot${remaining === 1 ? "" : "s"} available on your active subscription`;
}

function appendFeatures(
  container: HTMLElement,
  features: string[],
  includedStatus?: IncludedPlanStatus
) {
  let list = container.querySelector<HTMLUListElement>(
    '[data-loombus-room-plan-features="true"]'
  );
  if (!list) {
    list = document.createElement("ul");
    list.dataset.loombusRoomPlanFeatures = "true";
    list.className = "rooms-v2-plan-feature-list";

    for (const feature of features) {
      const item = document.createElement("li");
      const mark = document.createElement("span");
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = "✓";
      const copy = document.createElement("span");
      copy.textContent = feature;
      item.append(mark, copy);
      list.append(item);
    }
    container.append(list);
  }

  const includedCopy = includedStatus
    ? includedCapacityCopy(includedStatus)
    : null;
  const existingIncluded = list.querySelector<HTMLElement>(
    '[data-loombus-included-room-capacity="true"]'
  );

  if (!includedCopy) {
    existingIncluded?.remove();
    return;
  }
  if (existingIncluded) {
    const copy = existingIncluded.querySelector<HTMLElement>("span:last-child");
    if (copy) copy.textContent = includedCopy;
    return;
  }

  const item = document.createElement("li");
  item.dataset.loombusIncludedRoomCapacity = "true";
  item.className = "is-included-capacity";
  const mark = document.createElement("span");
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "+";
  const copy = document.createElement("span");
  copy.textContent = includedCopy;
  item.append(mark, copy);
  list.append(item);
}

function replaceButtonCopy(button: HTMLButtonElement, value: string) {
  for (const node of Array.from(button.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      node.textContent = value;
      return;
    }
  }
  button.append(document.createTextNode(value));
}

function updateReviewAction(
  root: Element,
  includedPlans: Partial<Record<RoomPlanKey, IncludedPlanStatus>>
) {
  const checkoutButton = Array.from(
    root.querySelectorAll<HTMLButtonElement>("button")
  ).find((button) =>
    /continue to monthly checkout|create included room/i.test(
      button.textContent?.trim() ?? ""
    )
  );
  if (!checkoutButton) return;

  const selectedPlan = PLAN_LABELS.find((plan) => {
    const headings = Array.from(root.querySelectorAll("h2, h3"));
    return headings.some((heading) => heading.textContent?.trim() === plan.label);
  });
  const included = selectedPlan ? includedPlans[selectedPlan.id] : undefined;

  if (included?.available) {
    replaceButtonCopy(checkoutButton, "Create included Room");
    checkoutButton.title = "This Room is included in your active subscription.";
  } else {
    replaceButtonCopy(checkoutButton, "Continue to monthly checkout");
    checkoutButton.removeAttribute("title");
  }
}

export function RoomPlanFeatureEnhancer() {
  const [includedPlans, setIncludedPlans] = useState<
    Partial<Record<RoomPlanKey, IncludedPlanStatus>>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function loadIncludedPlans() {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) return;
      const response = await fetch("/api/rooms/checkout-config", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const result = (await response.json().catch(() => ({}))) as CheckoutConfigResponse;
      if (!cancelled) setIncludedPlans(result.includedPlans ?? {});
    }

    void loadIncludedPlans();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let scheduled = false;

    const apply = () => {
      scheduled = false;
      const root = document.querySelector(".rooms-v2-builder-page");
      if (!root) return;

      for (const plan of PLAN_LABELS) {
        const container = findPlanContainer(root, plan.label);
        if (container) {
          appendFeatures(container, plan.features, includedPlans[plan.id]);
        }
      }
      updateReviewAction(root, includedPlans);
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(apply);
    };

    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [includedPlans]);

  return null;
}
