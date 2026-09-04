"use client";

import { useEffect } from "react";

const SESSION_TITLE = "Device and session security";
const VERIFICATION_TITLE = "Verification status";

function currentDeviceLabel() {
  if (typeof navigator === "undefined") return "Current device";

  const ua = navigator.userAgent;
  let browser = "Browser";
  let version = "";

  const edge = ua.match(/Edg\/([\d.]+)/);
  const chrome = ua.match(/(?:Chrome|CriOS)\/([\d.]+)/);
  const firefox = ua.match(/(?:Firefox|FxiOS)\/([\d.]+)/);
  const safari = ua.match(/Version\/([\d.]+).*Safari/);

  if (edge) {
    browser = "Microsoft Edge";
    version = edge[1];
  } else if (chrome) {
    browser = "Chrome";
    version = chrome[1];
  } else if (firefox) {
    browser = "Firefox";
    version = firefox[1];
  } else if (safari) {
    browser = "Safari";
    version = safari[1];
  }

  let device = "Current device";
  if (/iPhone/.test(ua)) device = "iPhone";
  else if (/iPad/.test(ua)) device = "iPad";
  else if (/Android/.test(ua)) device = "Android";
  else if (/Macintosh|Mac OS X/.test(ua)) device = "macOS";
  else if (/Windows/.test(ua)) device = "Windows";
  else if (/Linux/.test(ua)) device = "Linux";

  return `${browser}${version ? ` ${version}` : ""} · ${device}`;
}

function markEditorialPanels() {
  const panels = document.querySelectorAll<HTMLElement>(".settings-expansion-panel");

  panels.forEach((panel) => {
    const title = panel.querySelector<HTMLElement>(".settings-expansion-panel-heading h3")?.textContent?.trim();

    if (title === SESSION_TITLE) {
      panel.classList.add("settings-account-editorial-panel", "settings-account-editorial-sessions");
      const summary = panel.querySelector<HTMLElement>(".settings-expansion-summary-card");
      if (summary) summary.dataset.deviceLabel = currentDeviceLabel();
    }

    if (title === VERIFICATION_TITLE) {
      panel.classList.add("settings-account-editorial-panel", "settings-account-editorial-verification");
    }
  });
}

export function SettingsAccountEditorialRefinement() {
  useEffect(() => {
    markEditorialPanels();

    const observer = new MutationObserver(() => markEditorialPanels());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
