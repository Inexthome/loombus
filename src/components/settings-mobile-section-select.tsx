"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

const SETTINGS_SECTIONS = [
  "Account & Security",
  "Profile & Identity",
  "Privacy & Safety",
  "Messages",
  "Notifications & Alerts",
  "Appearance",
  "Subscriptions & Billing",
  "Data & Activity",
] as const;

type SettingsSectionLabel = (typeof SETTINGS_SECTIONS)[number];

function isSettingsSectionLabel(value: string): value is SettingsSectionLabel {
  return SETTINGS_SECTIONS.some((label) => label === value);
}

export function SettingsMobileSectionSelect() {
  const [mountTarget, setMountTarget] = useState<HTMLElement | null>(null);
  const [activeLabel, setActiveLabel] = useState<SettingsSectionLabel>(
    "Account & Security"
  );

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;
    let observer: MutationObserver | null = null;

    function connect() {
      const nav = document.querySelector<HTMLElement>(".settings-workspace-nav");

      if (!nav) {
        if (!cancelled) {
          retryTimer = window.setTimeout(connect, 100);
        }
        return;
      }

      let slot = nav.querySelector<HTMLElement>(
        "[data-settings-mobile-section-select]"
      );

      if (!slot) {
        slot = document.createElement("div");
        slot.dataset.settingsMobileSectionSelect = "true";
        const mobileHeading = nav.querySelector<HTMLElement>(
          ".settings-workspace-mobile-heading"
        );

        if (mobileHeading) {
          mobileHeading.after(slot);
        } else {
          nav.prepend(slot);
        }
      }

      const syncActiveSection = () => {
        const activeButton = [
          ...nav.querySelectorAll<HTMLButtonElement>(":scope > button"),
        ].find((button) => button.classList.contains("is-active"));
        const nextLabel = activeButton?.textContent?.trim() ?? "";

        if (isSettingsSectionLabel(nextLabel)) {
          setActiveLabel(nextLabel);
        }
      };

      syncActiveSection();
      observer = new MutationObserver(syncActiveSection);
      observer.observe(nav, {
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
      setMountTarget(slot);
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      observer?.disconnect();
    };
  }, []);

  function chooseSection(nextLabel: SettingsSectionLabel) {
    const nav = document.querySelector<HTMLElement>(".settings-workspace-nav");
    if (!nav) return;

    const button = [
      ...nav.querySelectorAll<HTMLButtonElement>(":scope > button"),
    ].find((candidate) => candidate.textContent?.trim() === nextLabel);

    if (!button) return;

    setActiveLabel(nextLabel);
    button.click();
  }

  if (!mountTarget) return null;

  return createPortal(
    <div className="settings-mobile-section-select-control">
      <select
        aria-label="Settings section"
        value={activeLabel}
        onChange={(event) =>
          chooseSection(event.target.value as SettingsSectionLabel)
        }
      >
        {SETTINGS_SECTIONS.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>
    </div>,
    mountTarget
  );
}
