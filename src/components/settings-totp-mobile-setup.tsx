"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type TotpTarget = {
  container: HTMLElement;
  legacySecretRow: HTMLElement | null;
  secret: string;
};

function buildTotpUri(secret: string, accountLabel: string) {
  const label = `Loombus:${accountLabel}`;
  const params = new URLSearchParams({
    secret,
    issuer: "Loombus",
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

function groupSecret(secret: string) {
  return secret.replace(/\s+/g, "").match(/.{1,4}/g)?.join(" ") ?? secret;
}

export function SettingsTotpMobileSetup() {
  const [target, setTarget] = useState<TotpTarget | null>(null);
  const [accountLabel, setAccountLabel] = useState("Loombus member");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    let alive = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const email = data.user?.email?.trim();
      const phone = data.user?.phone?.trim();
      setAccountLabel(email || phone || "Loombus member");
    });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let previousLegacyRow: HTMLElement | null = null;

    const locate = () => {
      const enrollment = document.querySelector<HTMLElement>(".settings-expansion-totp");
      const code = enrollment?.querySelector<HTMLElement>("code");
      const container = enrollment?.querySelector<HTMLElement>(":scope > div");
      const secret = code?.textContent?.replace(/\s+/g, "").trim() ?? "";
      const legacySecretRow = code?.closest("span") as HTMLElement | null;

      if (!enrollment || !container || !secret) {
        if (previousLegacyRow) previousLegacyRow.hidden = false;
        previousLegacyRow = null;
        setTarget(null);
        return;
      }

      if (previousLegacyRow && previousLegacyRow !== legacySecretRow) {
        previousLegacyRow.hidden = false;
      }
      if (legacySecretRow) legacySecretRow.hidden = true;
      previousLegacyRow = legacySecretRow;

      setTarget((current) => {
        if (
          current?.container === container &&
          current.secret === secret &&
          current.legacySecretRow === legacySecretRow
        ) {
          return current;
        }
        return { container, legacySecretRow, secret };
      });
    };

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      if (previousLegacyRow) previousLegacyRow.hidden = false;
    };
  }, []);

  const totpUri = useMemo(
    () => (target ? buildTotpUri(target.secret, accountLabel) : ""),
    [target, accountLabel]
  );

  async function copySetupKey() {
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.secret);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 2600);
    }
  }

  if (!target) return null;

  return createPortal(
    <div className="settings-totp-mobile-options" aria-label="Authenticator setup options">
      <div className="settings-totp-mobile-primary">
        <strong>Set up on this device</strong>
        <span>
          Open a compatible authenticator app with your Loombus account and setup key already filled in.
        </span>
        <a
          href={totpUri}
          className="settings-v2-secondary-action settings-totp-open-app"
        >
          Open in authenticator app
        </a>
      </div>

      <div className="settings-totp-mobile-key">
        <span>Manual setup key</span>
        <code>{groupSecret(target.secret)}</code>
        <button
          type="button"
          className="settings-v2-quiet-button"
          onClick={() => void copySetupKey()}
        >
          {copyStatus === "copied" ? "Copied" : "Copy key"}
        </button>
      </div>

      <p className="settings-totp-account-label">
        Authenticator label: <strong>Loombus — {accountLabel}</strong>
      </p>
      {copyStatus === "failed" ? (
        <p className="settings-totp-copy-error" role="status">
          Copy was unavailable. Press and hold the setup key to copy it manually.
        </p>
      ) : null}
    </div>,
    target.container
  );
}
