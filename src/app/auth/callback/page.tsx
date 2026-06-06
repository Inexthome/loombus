"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/discussions";
  }

  return value;
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

export default function AuthCallbackPage() {
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function completeAuthCallback() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash
      );

      const code = params.get("code");
      const next = getSafeNext(params.get("next"));

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        window.location.replace(next);
        return;
      }

      const hashHasSession =
        hashParams.has("access_token") ||
        hashParams.has("refresh_token") ||
        hashParams.has("provider_token");

      const existingSession = await waitForSession(hashHasSession ? 30 : 12);

      if (existingSession) {
        window.location.replace(next);
        return;
      }

      setErrorMessage(
        "Loombus could not finish the sign-in session. Please return to login and try again."
      );
    }

    completeAuthCallback();
  }, []);

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Loombus sign-in
          </p>

          <h1 className="mb-4 text-3xl font-semibold tracking-tight">
            Sign-in could not finish.
          </h1>

          <p className="mb-6 leading-relaxed text-zinc-400">
            {errorMessage}
          </p>

          <Link
            href="/login"
            className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Return to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
        <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Loombus sign-in
        </p>

        <h1 className="mb-4 text-3xl font-semibold tracking-tight">
          Finishing sign-in...
        </h1>

        <p className="leading-relaxed text-zinc-400">
          Please wait while Loombus completes your sign-in.
        </p>
      </div>
    </main>
  );
}
