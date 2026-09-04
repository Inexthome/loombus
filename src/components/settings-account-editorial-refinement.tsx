"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

const ACCOUNT_DETAILS_TITLE = "Private account information";
const EMAIL_TITLE = "Change account email";
const CONNECTED_ACCOUNTS_TITLE = "Sign-in methods";
const MFA_TITLE = "Authenticator protection";
const SESSION_TITLE = "Device and session security";
const VERIFICATION_TITLE = "Verification status";

type DisconnectPrompt = {
  provider: string;
  title: string;
  body: string;
};

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

function disconnectPromptFor(provider: string): DisconnectPrompt {
  if (provider === "Google") {
    return {
      provider,
      title: "Disconnect Google?",
      body: "You will no longer be able to sign in with this Google account.",
    };
  }

  if (provider === "Apple") {
    return {
      provider,
      title: "Disconnect Apple?",
      body: "You will no longer be able to sign in with this Apple account.",
    };
  }

  if (provider === "Email & password") {
    return {
      provider,
      title: "Disconnect email & password?",
      body: "You will no longer be able to sign in with this email and password.",
    };
  }

  return {
    provider,
    title: `Disconnect ${provider}?`,
    body: `You will no longer be able to sign in with this ${provider} account.`,
  };
}

function markEditorialPanels() {
  const panels = document.querySelectorAll<HTMLElement>(".settings-expansion-panel");

  panels.forEach((panel) => {
    const title = panel.querySelector<HTMLElement>(".settings-expansion-panel-heading h3")?.textContent?.trim();

    if (title === ACCOUNT_DETAILS_TITLE) {
      panel.classList.add("settings-account-editorial-panel", "settings-account-editorial-details");
    }

    if (title === EMAIL_TITLE) {
      panel.classList.add("settings-account-editorial-panel", "settings-account-editorial-email");
    }

    if (title === CONNECTED_ACCOUNTS_TITLE) {
      panel.classList.add("settings-account-editorial-panel", "settings-account-editorial-connected");
    }

    if (title === MFA_TITLE) {
      panel.classList.add("settings-account-editorial-panel", "settings-account-editorial-mfa");
    }

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
  const [disconnectPrompt, setDisconnectPrompt] = useState<DisconnectPrompt | null>(null);
  const pendingDisconnectButton = useRef<HTMLButtonElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    markEditorialPanels();

    const observer = new MutationObserver(() => markEditorialPanels());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function interceptDisconnect(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>(
        ".settings-account-editorial-connected .settings-v2-quiet-button"
      );

      if (
        !button ||
        button.disabled ||
        button.textContent?.trim() !== "Disconnect" ||
        button.dataset.loombusDisconnectConfirmed === "true"
      ) {
        return;
      }

      const provider = button
        .closest("article")
        ?.querySelector<HTMLElement>("strong")
        ?.textContent?.trim();

      if (!provider) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      pendingDisconnectButton.current = button;
      setDisconnectPrompt(disconnectPromptFor(provider));
    }

    document.addEventListener("click", interceptDisconnect, true);
    return () => document.removeEventListener("click", interceptDisconnect, true);
  }, []);

  useEffect(() => {
    if (!disconnectPrompt) return;

    cancelButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        pendingDisconnectButton.current = null;
        setDisconnectPrompt(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [disconnectPrompt]);

  function cancelDisconnect() {
    pendingDisconnectButton.current = null;
    setDisconnectPrompt(null);
  }

  function confirmDisconnect() {
    const button = pendingDisconnectButton.current;
    pendingDisconnectButton.current = null;
    setDisconnectPrompt(null);

    if (!button) return;

    button.dataset.loombusDisconnectConfirmed = "true";
    button.click();
    window.setTimeout(() => {
      delete button.dataset.loombusDisconnectConfirmed;
    }, 0);
  }

  return disconnectPrompt && typeof document !== "undefined"
    ? createPortal(
        <div
          className="settings-loombus-prompt-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cancelDisconnect();
          }}
        >
          <section
            className="settings-loombus-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-disconnect-prompt-title"
            aria-describedby="settings-disconnect-prompt-body"
          >
            <p className="settings-loombus-prompt-eyebrow">Connected account</p>
            <h2 id="settings-disconnect-prompt-title">{disconnectPrompt.title}</h2>
            <p id="settings-disconnect-prompt-body">{disconnectPrompt.body}</p>
            <div className="settings-loombus-prompt-actions">
              <button
                ref={cancelButtonRef}
                type="button"
                className="settings-loombus-prompt-cancel"
                onClick={cancelDisconnect}
              >
                Cancel
              </button>
              <button
                type="button"
                className="settings-loombus-prompt-confirm"
                onClick={confirmDisconnect}
              >
                Disconnect {disconnectPrompt.provider}
              </button>
            </div>
          </section>
        </div>,
        document.body
      )
    : null;
}
