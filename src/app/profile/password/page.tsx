"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [hasPasswordLogin, setHasPasswordLogin] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data, error: userError } = await supabase.auth.getUser();

      if (!mounted) return;

      if (userError || !data.user) {
        router.push("/login");
        return;
      }

      const userEmail = data.user.email ?? "";
      const providers = Array.isArray(data.user.app_metadata?.providers)
        ? (data.user.app_metadata.providers as string[])
        : [];
      const primaryProvider =
        typeof data.user.app_metadata?.provider === "string"
          ? data.user.app_metadata.provider
          : "";

      setEmail(userEmail);
      setHasPasswordLogin(
        providers.includes("email") || primaryProvider === "email"
      );
      setLoading(false);
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!email) {
      setError("We could not verify your account email. Please sign in again.");
      return;
    }

    if (!currentPassword.trim()) {
      setError("Enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setSaving(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      setSaving(false);
      setError("Current password is incorrect.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSaving(false);

    if (updateError) {
      setError(updateError.message || "Unable to update password.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess("Password updated successfully.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-slate-300">Loading account security…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/profile"
          className="inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200"
        >
          ← Back to profile
        </Link>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Account security
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Change password
            </h1>
            <p className="text-sm leading-6 text-slate-300">
              Update the password used to sign in to your Loombus account.
            </p>
          </div>

          {!hasPasswordLogin ? (
            <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
              This account appears to use a third-party sign-in provider.
              Password changes are managed through that provider.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-200">
                  Current password
                </span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300/30 focus:border-cyan-300 focus:ring-4"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-200">
                  New password
                </span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300/30 focus:border-cyan-300 focus:ring-4"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-200">
                  Confirm new password
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300/30 focus:border-cyan-300 focus:ring-4"
                  required
                />
              </label>

              {error ? (
                <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                  {success}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Updating password…" : "Save new password"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
