"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { ContactRound, MessageSquareLock, Phone, Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Preferences = {
  phoneDiscoverable: boolean;
  contactMatchingEnabled: boolean;
  securitySmsEnabled: boolean;
};

type PhoneState = {
  masked: string | null;
  verified: boolean;
};

type Capabilities = {
  phoneAuth: boolean;
  contactMatching: boolean;
  securitySmsDelivery: boolean;
};

const DEFAULT_PREFERENCES: Preferences = {
  phoneDiscoverable: false,
  contactMatchingEnabled: false,
  securitySmsEnabled: false,
};

function getUsNationalDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

function formatUsPhone(value: string) {
  const digits = getUsNationalDigits(value);
  if (!digits) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function normalizeUsPhone(value: string) {
  const digits = getUsNationalDigits(value);
  return digits.length === 10 ? `+1${digits}` : null;
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function Toggle({
  title,
  description,
  checked,
  disabled,
  onChange,
  icon: Icon,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  icon: typeof Phone;
}) {
  return (
    <label className="member-privacy-toggle">
      <span className="member-privacy-toggle-icon"><Icon aria-hidden="true" /></span>
      <span className="member-privacy-toggle-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className="member-privacy-switch">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span aria-hidden="true" />
      </span>
    </label>
  );
}

export function PhoneSecuritySettingsBridge() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [phone, setPhone] = useState<PhoneState>({ masked: null, verified: false });
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [capabilities, setCapabilities] = useState<Capabilities>({
    phoneAuth: true,
    contactMatching: false,
    securitySmsDelivery: false,
  });
  const [newPhone, setNewPhone] = useState("");
  const [verificationPhone, setVerificationPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMount(document.getElementById("privacy"));
  }, []);

  async function load() {
    const token = await getToken();
    if (!token) return;

    const response = await fetch("/api/settings/phone-privacy", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));

    if (response.ok) {
      setPhone(payload.phone ?? { masked: null, verified: false });
      setPreferences({ ...DEFAULT_PREFERENCES, ...(payload.preferences ?? {}) });
      setCapabilities((current) => ({ ...current, ...(payload.capabilities ?? {}) }));
    } else {
      setMessage(payload.error ?? "Mobile-number settings could not load.");
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function sendPhoneVerification() {
    const normalized = normalizeUsPhone(newPhone);
    if (!normalized) {
      setMessage("Enter a valid 10-digit U.S. mobile number.");
      return;
    }

    setWorking(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ phone: normalized });
    if (error) {
      setMessage(error.message || "Unable to send the verification code.");
      setWorking(false);
      return;
    }

    setVerificationPhone(normalized);
    setAwaitingOtp(true);
    setMessage("Verification code sent by SMS.");
    setWorking(false);
  }

  async function verifyPhoneChange() {
    if (!/^\d{6}$/.test(otp.trim())) {
      setMessage("Enter the 6-digit verification code.");
      return;
    }

    setWorking(true);
    setMessage("");
    const { error } = await supabase.auth.verifyOtp({
      phone: verificationPhone,
      token: otp.trim(),
      type: "phone_change",
    });

    if (error) {
      setMessage(error.message || "The verification code could not be confirmed.");
      setWorking(false);
      return;
    }

    setAwaitingOtp(false);
    setOtp("");
    setNewPhone("");
    setVerificationPhone("");
    setMessage("Mobile number verified.");
    setWorking(false);
    await load();
  }

  async function savePhoneDiscovery(enabled: boolean) {
    const previous = preferences;
    const next = { ...preferences, phoneDiscoverable: enabled };
    setPreferences(next);
    setWorking(true);
    setMessage("");

    const token = await getToken();
    if (!token) {
      window.location.href = "/login?next=/settings?section=privacy-safety";
      return;
    }

    const response = await fetch("/api/settings/phone-privacy", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(next),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setPreferences(previous);
      setMessage(payload.error ?? "Phone privacy settings could not be saved.");
    } else {
      setPreferences({ ...next, ...(payload.preferences ?? {}) });
      setMessage("Phone privacy settings saved.");
    }
    setWorking(false);
  }

  if (!mount) return null;

  return createPortal(
    <section className="member-privacy-settings" aria-labelledby="verified-mobile-heading">
      <div className="member-privacy-heading">
        <div>
          <p>Verified mobile number</p>
          <h3 id="verified-mobile-heading">Use your number for sign-in and account security without making it public.</h3>
        </div>
        <span>{loading ? "Loading" : working ? "Saving" : phone.verified ? "Verified" : "Not verified"}</span>
      </div>

      <div className="rounded-xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong className="block text-[color:var(--loombus-text)]">{phone.masked ?? "No mobile number added"}</strong>
            <span className="text-sm text-[color:var(--loombus-text-muted)]">Your full number is never displayed on your public Loombus profile.</span>
          </div>
          {phone.verified ? <span className="text-sm font-semibold">Verified</span> : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <div className="flex overflow-hidden rounded-lg border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] focus-within:ring-2 focus-within:ring-[color:var(--loombus-border)]">
              <span className="flex items-center gap-2 border-r border-[color:var(--loombus-border)] px-3 text-sm font-semibold" aria-hidden="true">
                <span>🇺🇸</span><span>+1</span>
              </span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={newPhone}
                disabled={working || awaitingOtp}
                onChange={(event) => setNewPhone(formatUsPhone(event.target.value))}
                placeholder="(904) 555-1234"
                aria-label="U.S. mobile number"
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[color:var(--loombus-text)] outline-none"
              />
            </div>
            <p className="mt-2 text-xs text-[color:var(--loombus-text-muted)]">U.S. numbers use +1 automatically.</p>
          </div>
          <button
            type="button"
            className="settings-v2-secondary-action self-start"
            disabled={working || awaitingOtp}
            onClick={() => void sendPhoneVerification()}
          >
            {phone.verified ? "Change number" : "Add & verify"}
          </button>
        </div>

        <p className="mt-3 text-xs leading-5 text-[color:var(--loombus-text-muted)]">
          By requesting a verification code, you consent to receive a transactional SMS from Loombus for authentication. Message frequency varies based on your requests. Message and data rates may apply. No marketing messages are sent through this program. See the{" "}
          <Link href="/terms#sms-authentication" className="font-semibold underline underline-offset-2">Terms</Link>{" "}
          and{" "}
          <Link href="/privacy#mobile-sms-auth" className="font-semibold underline underline-offset-2">Privacy Policy</Link>.
        </p>

        {awaitingOtp ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              disabled={working}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              aria-label="SMS verification code"
              className="min-w-0 rounded-lg border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-3 py-2 text-[color:var(--loombus-text)]"
            />
            <button
              type="button"
              className="settings-v2-secondary-action"
              disabled={working}
              onClick={() => void verifyPhoneChange()}
            >
              Verify code
            </button>
          </div>
        ) : null}
      </div>

      <div className="member-privacy-toggle-list">
        <Toggle
          title="Allow people who have my phone number to find me"
          description="Opt in to secure phone-number discovery. Your number itself is never shown to other members."
          checked={preferences.phoneDiscoverable}
          disabled={loading || working || !phone.verified}
          onChange={(value) => void savePhoneDiscovery(value)}
          icon={Search}
        />
        <Toggle
          title="Contact matching"
          description={capabilities.contactMatching ? "Match contacts you explicitly choose against opted-in Loombus members." : "Coming after Loombus adds a private contact-matching service. Contact access will require a separate explicit permission."}
          checked={preferences.contactMatchingEnabled}
          disabled={!capabilities.contactMatching || loading || working}
          onChange={() => undefined}
          icon={ContactRound}
        />
        <Toggle
          title="Security SMS alerts"
          description={capabilities.securitySmsDelivery ? "Receive important account-security alerts by SMS." : "Available after Loombus configures a general security-SMS delivery provider. Authentication codes remain separate."}
          checked={preferences.securitySmsEnabled}
          disabled={!capabilities.securitySmsDelivery || loading || working}
          onChange={() => undefined}
          icon={MessageSquareLock}
        />
      </div>

      {message ? <p className="member-privacy-message" role="status">{message}</p> : null}

      <p className="member-follow-requests-empty">
        Loombus does not use your mobile number for public display, advertising profiles, or SMS marketing. Phone-number discovery is off by default.
      </p>
    </section>,
    mount
  );
}
