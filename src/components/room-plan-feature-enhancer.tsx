"use client";

import { useEffect } from "react";
import { ROOM_PLAN_ENTITLEMENTS } from "@/lib/room-plan-entitlements";

const PLAN_LABELS = Object.values(ROOM_PLAN_ENTITLEMENTS).map((plan) => ({
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

function appendFeatures(container: HTMLElement, features: string[]) {
  const existing = container.querySelector<HTMLElement>(
    '[data-loombus-room-plan-features="true"]'
  );
  if (existing) return;

  const list = document.createElement("ul");
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

export function RoomPlanFeatureEnhancer() {
  useEffect(() => {
    let scheduled = false;

    const apply = () => {
      scheduled = false;
      const root = document.querySelector(".rooms-v2-builder-page");
      if (!root) return;

      for (const plan of PLAN_LABELS) {
        const container = findPlanContainer(root, plan.label);
        if (container) appendFeatures(container, plan.features);
      }
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
  }, []);

  return null;
}
