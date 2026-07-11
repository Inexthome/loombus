"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { getAuthErrorMessage } from "@/lib/auth-error-message";
import { isIosNativeApp } from "@/lib/native-app";
import { supabase } from "@/lib/supabase/client";

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/discussions";
  }

  return value;
}

function shouldBounceNativeOAuthCallback(params: URLSearchParams) {
  if (isIosNativeApp()) {
    return false;
  }

  if (params.get("native_oauth") !== "1") {
    return false;
  }

  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

function bounceNativeOAuthCallbackToApp() {
  const targetUrl = `loombus://auth/callback${window.location.search}${window.location.hash}`;

  window.location.replace(targetUrl);
}

async function waitForSession(maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data } = await supabase.auth.getSession();

    if (data.session) {
      return data.session;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return null;
}

async function getPostAuthRedirect(next: string, sessionOverride: Session | null = null) {
  const session = sessionOverride ?? (await supabase.auth.getSession()).data.session;

  if (!session) {
    return next;
  }

  const { data: profile } = await supabase
    .from("profile_sensitive")
    .select("age_band")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profile?.age_band && profile.age_band !== "unknown") {
    return next;
  }

  const metadataDateOfBirth =
    typeof session.user.user_metadata?.date_of_birth === "string"
      ? session.user.user_metadata.date_of_birth
      : "";

  const pendingDateOfBirth =
    typeof window !== "undefined"
      ? window.localStorage.getItem("loombus:pending-date-of-birth") ?? ""
      : "";

  const dateOfBirth = metadataDateOfBirth || pendingDateOfBirth;

  if (dateOfBirth) {
    const response = await fetch("/api/profile/age-gate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        dateOfBirth,
      }),
    });

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("loombus:pending-date-of-birth");
    }

    if (response.ok) {
      return next;
    }

    const payload = await response.json().catch(() => ({}));

    if (
      payload.code === "account_not_eligible" ||
      payload.code === "under_13_not_allowed"
    ) {
      await supabase.auth.signOut();
      return "/signup?ineligible=1";
    }
  }

  return `/age-gate?next=${encodeURIComponent(next)}`;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [retryHref, setRetryHref] = useState("/login");

  useEffect(() => {
    async function completeAuthCallback() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash
      );
      const next = getSafeNext(params.get("next"));
      setRetryHref(`/login?next=${encodeURIComponent(next)}`);

      try {
        if (shouldBounceNativeOAuthCallback(params)) {
          bounceNativeOAuthCallbackToApp();
          return;
        }

        const providerError =
          params.get("error_description") ||
          params.get("error") ||
          hashParams.get("error_description") ||
          hashParams.get("error");

        if (providerError) {
          setErrorMessage(getAuthErrorMessage(providerError, "oauth"));
          return;
        }

        const code = params.get("code");

        if (code) {
          const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            setErrorMessage(getAuthErrorMessage(error, "callback"));
            return;
          }

          const destination = await getPostAuthRedirect(next, exchangeData.session ?? null);
          router.replace(destination);
          return;
        }

        const hashHasSession =
          hashParams.has("access_token") ||
          hashParams.has("refresh_token") ||
          hashParams.has("provider_token");

        const existingSession = await waitForSession(hashHasSession ? 30 : 12);

        if (existingSession) {
          const destination = await getPostAuthRedirect(next, existingSession);
          router.replace(destination);
          return;
        }

        setErrorMessage(
          "Loombus could not finish the sign-in session. Return to login and try again."
        );
      } catch (error) {
        setErrorMessage(getAuthErrorMessage(error, "callback"));
      }
    }

    void completeAuthCallback();
  }, [router]);

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-7">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Loombus sign-in
          </p>

          <h1 className="mb-4 text-3xl font-semibold tracking-tight">
            Sign-in could not finish.
          </h1>

          <p role="alert" className="mb-6 leading-relaxed text-zinc-400">
            {errorMessage}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={retryHref}
              className="inline-flex justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Try signing in again
            </Link>
            <Link
              href="/forgot-password"
              className="inline-flex justify-center rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Reset password
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <LoombusLoadingScreen
      eyebrow="Loombus sign-in"
      title="Finishing sign-in..."
      message="Securing your Loombus session."
    />
  );
}
