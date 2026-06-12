"use client";

import { useEffect, useState } from "react";
import {
  deleteNativeBiometricLoginCredentials,
  getNativeBiometricAvailability,
  getRememberedBiometricLoginEmail,
} from "@/lib/native-biometric";
import { isNativeApp } from "@/lib/native-app";

type Availability = Awaited<ReturnType<typeof getNativeBiometricAvailability>>;

export function NativeBiometricSettingsCard() {
  const [isNative, setIsNative] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rememberedEmail, setRememberedEmail] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(true);

  async function refreshStatus() {
    setChecking(true);
    setMessage("");

    const native = isNativeApp();
    const available = await getNativeBiometricAvailability();
    const rememberedEmail = native ? getRememberedBiometricLoginEmail() : "";
    const credentialsSaved = Boolean(rememberedEmail);

    setIsNative(native);
    setAvailability(available);
    setSaved(credentialsSaved);
    setRememberedEmail(rememberedEmail);
    setChecking(false);
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function forgetSavedLogin() {
    await deleteNativeBiometricLoginCredentials();
    setSaved(false);
    setRememberedEmail("");
    setMessage("Saved biometric sign-in removed from this device.");
  }

  return (
    <section className="mb-6 rounded-2xl border border-zinc-900 bg-black p-4 text-white sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Native app security
          </p>
          <h2 className="mt-1 text-base font-semibold">
            Face ID / biometric sign-in
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            Save an email login on this device and use Face ID, Touch ID,
            fingerprint, or passcode to sign in.
          </p>

          {checking ? (
            <p className="mt-2 text-xs text-zinc-500">
              Checking this device for biometric sign-in support...
            </p>
          ) : null}

          {!checking && !isNative ? (
            <p className="mt-2 text-xs text-zinc-500">
              Biometric sign-in only works in the installed iOS or Android app.
            </p>
          ) : null}

          {!checking && isNative && availability?.isAvailable === false ? (
            <p className="mt-2 text-xs text-zinc-500">
              Set up a device passcode, Face ID, Touch ID, or fingerprint before
              enabling biometric sign-in.
            </p>
          ) : null}

          {saved ? (
            <p className="mt-2 text-xs text-zinc-400">
              Saved for {rememberedEmail || "this device"}.
            </p>
          ) : isNative && availability?.isAvailable ? (
            <p className="mt-2 text-xs text-zinc-500">
              Sign in with email/password once and Loombus will ask whether to
              remember that login with Face ID or device biometrics.
            </p>
          ) : null}

          {message ? (
            <p className="mt-2 text-xs text-zinc-400">{message}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {saved ? (
            <button
              type="button"
              onClick={() => void forgetSavedLogin()}
              disabled={checking}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Forget
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void refreshStatus()}
            disabled={checking}
            className="rounded-full border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh status
          </button>
        </div>
      </div>
    </section>
  );
}
