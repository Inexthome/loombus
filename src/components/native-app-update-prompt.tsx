"use client";

import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { isNativeApp } from "@/lib/native-app";

type PlatformKey = "ios" | "android";

type UpdatePolicy = {
  latestVersion: string;
  minimumVersion?: string;
  updateUrl?: string;
  title?: string;
  message?: string;
  required?: boolean;
};

type UpdatePolicyFile = Partial<Record<PlatformKey, UpdatePolicy>>;

type PromptState = {
  platform: PlatformKey;
  installedVersion: string;
  policy: UpdatePolicy;
  required: boolean;
  dismissKey: string;
};

const DEFAULT_UPDATE_URL = "/download";

function parseVersion(version: string) {
  return version
    .split(".")
    .map((part) => Number.parseInt(part.replace(/\D+/g, ""), 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function compareVersions(left: string, right: string) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart > rightPart) {
      return 1;
    }

    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

function isSupportedPlatform(platform: string): platform is PlatformKey {
  return platform === "ios" || platform === "android";
}

export function NativeAppUpdatePrompt() {
  const [prompt, setPrompt] = useState<PromptState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkForUpdate() {
      if (!isNativeApp()) {
        return;
      }

      const platform = Capacitor.getPlatform();

      if (!isSupportedPlatform(platform)) {
        return;
      }

      try {
        const [appInfo, response] = await Promise.all([
          App.getInfo(),
          fetch(`/app-update.json?ts=${Date.now()}`, {
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          }),
        ]);

        if (!response.ok) {
          return;
        }

        const policyFile = (await response.json()) as UpdatePolicyFile;
        const policy = policyFile[platform];

        if (!policy?.latestVersion) {
          return;
        }

        const installedVersion = appInfo.version || "0.0.0";
        const belowLatest =
          compareVersions(installedVersion, policy.latestVersion) < 0;
        const belowMinimum = policy.minimumVersion
          ? compareVersions(installedVersion, policy.minimumVersion) < 0
          : false;

        if (!belowLatest && !belowMinimum) {
          return;
        }

        const required = belowMinimum || policy.required === true;
        const dismissKey = `loombus:update-dismissed:${platform}:${policy.latestVersion}`;

        if (
          !required &&
          window.localStorage.getItem(dismissKey) === "true"
        ) {
          return;
        }

        if (!cancelled) {
          setPrompt({
            platform,
            installedVersion,
            policy,
            required,
            dismissKey,
          });
        }
      } catch (error) {
        console.warn("Unable to check Loombus app update policy.", error);
      }
    }

    void checkForUpdate();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!prompt) {
    return null;
  }

  const title =
    prompt.policy.title ??
    (prompt.required ? "Loombus update required" : "Loombus update available");
  const message =
    prompt.policy.message ??
    (prompt.required
      ? "This version of Loombus is no longer supported. Please update to continue."
      : "A new version of Loombus is available.");
  const updateUrl = prompt.policy.updateUrl ?? DEFAULT_UPDATE_URL;

  function handleDismiss() {
    if (!prompt || prompt.required) {
      return;
    }

    window.localStorage.setItem(prompt.dismissKey, "true");
    setPrompt(null);
  }

  function handleUpdate() {
    window.location.href = updateUrl;
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/75 px-6 text-white">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 p-7 text-center shadow-2xl shadow-black/50">
        <p className="mb-3 text-xs uppercase tracking-[0.3em] text-zinc-500">
          Loombus update
        </p>

        <h2 className="mb-3 text-2xl font-semibold tracking-tight">
          {title}
        </h2>

        <p className="mb-4 text-sm leading-relaxed text-zinc-400">
          {message}
        </p>

        <p className="mb-6 text-xs leading-relaxed text-zinc-600">
          Installed version: {prompt.installedVersion}. Latest version:{" "}
          {prompt.policy.latestVersion}.
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleUpdate}
            className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Update Loombus
          </button>

          {!prompt.required ? (
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full rounded-full border border-zinc-800 px-5 py-3 text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-white"
            >
              Later
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
