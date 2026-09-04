"use client";

import { createPortal } from "react-dom";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function providerLabel(providers: string[]) {
  if (providers.includes("google")) return "Google";
  if (providers.includes("apple")) return "Apple";
  return "your identity provider";
}

export function SettingsPasswordEditorialBridge() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [email, setEmail] = useState("");
  const [providers, setProviders] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | null = null;

    function locate() {
      const node = document.getElementById("account-security");
      if (!cancelled && node) setTarget(node);
      attempts += 1;
      if (!cancelled && !node && attempts < 80) {
        timer = window.setTimeout(locate, 100);
      }
    }

    locate();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadIdentity() {
      const token = await getToken();
      if (!token) return;

      const { data, error } = await supabase.auth.getUser();
      if (!alive || error || !data.user) return;

      const identityProviders = (data.user.identities ?? []).map(
        (identity) => identity.provider
      );
      const appProviders = Array.isArray(data.user.app_metadata?.providers)
        ? data.user.app_metadata.providers.filter(
            (value): value is string => typeof value === "string"
          )
        : [];
      const appProvider =
        typeof data.user.app_metadata?.provider === "string"
          ? [data.user.app_metadata.provider]
          : [];

      setEmail(data.user.email ?? "");
      setProviders(
        Array.from(new Set([...identityProviders, ...appProviders, ...appProvider]))
      );
    }

    void loadIdentity();
    return () => {
      alive = false;
    };
  }, []);

  const hasPasswordProvider = providers.includes("email");
  const managedBy = useMemo(() => providerLabel(providers), [providers]);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;

    setMessage("");

    if (!hasPasswordProvider) {
      setMessage(`Password access is managed through ${managedBy}.`);
      return;
    }

    if (!email) {
      setMessage("Unable to confirm your account email. Sign in again.");
      return;
    }

    if (!currentPassword.trim()) {
      setMessage("Enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      setMessage("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("New passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setMessage("Choose a password different from the current password.");
      return;
    }

    setWorking(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        setMessage("Current password is incorrect.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setMessage(updateError.message || "Password could not be changed.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOpen(false);
      setMessage("Password changed.");
    } finally {
      setWorking(false);
    }
  }

  if (!target) return null;

  return createPortal(
    <section className="settings-expansion-panel settings-account-editorial-panel settings-account-editorial-password">
      <div className="settings-expansion-panel-heading">
        <div>
          <p>Password</p>
          <h3>Change password</h3>
        </div>
      </div>

      {message ? (
        <div className="settings-v2-notice" role="status">
          {message}
        </div>
      ) : null}

      {hasPasswordProvider ? (
        <>
          {!open ? (
            <button
              type="button"
              className="settings-v2-secondary-action"
              onClick={() => {
                setMessage("");
                setOpen(true);
              }}
            >
              Change password
            </button>
          ) : (
            <form className="settings-v2-form settings-account-editorial-password-form" onSubmit={changePassword}>
              <label className="settings-v2-field">
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  className="settings-v2-input"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  disabled={working}
                />
              </label>

              <div className="settings-v2-form-row">
                <label className="settings-v2-field">
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="settings-v2-input"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    disabled={working}
                  />
                </label>

                <label className="settings-v2-field">
                  Confirm new password
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="settings-v2-input"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    disabled={working}
                  />
                </label>
              </div>

              <div className="settings-v2-inline-actions">
                <button
                  type="button"
                  className="settings-v2-secondary-action"
                  disabled={working}
                  onClick={() => {
                    setOpen(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setMessage("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="settings-v2-secondary-action"
                  disabled={working}
                >
                  {working ? "Saving…" : "Save new password"}
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <div className="settings-expansion-summary-card">
          <span>Password</span>
          <strong>Managed by {managedBy}</strong>
        </div>
      )}
    </section>,
    target
  );
}
