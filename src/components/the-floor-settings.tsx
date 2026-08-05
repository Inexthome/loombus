"use client";

import Link from "next/link";
import { CreditCard, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { BillingPortalButton } from "@/components/billing-portal-button";
import {
  FLOOR_COMPARATOR_OPTIONS,
  FLOOR_HORIZON_OPTIONS,
} from "@/lib/floor-shared";
import { supabase } from "@/lib/supabase/client";

type FloorSubscription = {
  plan_key: "floor_monthly" | "floor_annual";
  status: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
};

type AlertChannel = "in_app" | "email" | "both";
type WeaveDigest = "weekly" | "off";
type ChartTimeframe = "1d" | "1w" | "1m" | "ytd";
type LeaderboardDisplay = "username" | "full_name";

type FloorMemberPreferences = {
  falsification_alerts_enabled: boolean;
  alert_channel: AlertChannel;
  weave_digest: WeaveDigest;
  earnings_reminders_enabled: boolean;
  resolution_reminders_enabled: boolean;
  calibration_nudge_enabled: boolean;
  default_chart_timeframe: ChartTimeframe;
  default_call_horizon: string | null;
  default_call_comparator: string | null;
  show_on_leaderboard: boolean;
  leaderboard_display: LeaderboardDisplay;
};

const DEFAULT_PREFERENCES: FloorMemberPreferences = {
  falsification_alerts_enabled: true,
  alert_channel: "in_app",
  weave_digest: "weekly",
  earnings_reminders_enabled: true,
  resolution_reminders_enabled: true,
  calibration_nudge_enabled: true,
  default_chart_timeframe: "1d",
  default_call_horizon: null,
  default_call_comparator: null,
  show_on_leaderboard: true,
  leaderboard_display: "username",
};

function planName(plan: FloorSubscription["plan_key"]) {
  return plan === "floor_annual" ? "The Floor Annual" : "The Floor Monthly";
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className="floor-settings-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
      <span aria-hidden="true" />
    </label>
  );
}

export default function TheFloorSettings() {
  const [subscription, setSubscription] = useState<FloorSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<FloorMemberPreferences>(DEFAULT_PREFERENCES);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (mounted) setLoading(false);
        return;
      }
      const [subscriptionResult, profileResult, preferencesResult] = await Promise.all([
        supabase.from("floor_subscriptions").select("plan_key,status,stripe_subscription_id,current_period_end").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle(),
        supabase.from("floor_member_preferences").select("*").eq("user_id", auth.user.id).maybeSingle(),
      ]);
      if (!mounted) return;
      setSubscription((subscriptionResult.data as FloorSubscription | null) ?? null);
      setIsAdmin(profileResult.data?.is_admin === true);
      setUserId(auth.user.id);
      if (preferencesResult.data) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...(preferencesResult.data as Partial<FloorMemberPreferences>) });
      }
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, []);

  async function updatePreferences(patch: Partial<FloorMemberPreferences>) {
    if (!userId) return;
    const next = { ...preferences, ...patch };
    setPreferences(next);
    setSaveState("saving");
    const { error } = await supabase
      .from("floor_member_preferences")
      .upsert({ user_id: userId, ...next }, { onConflict: "user_id" });
    setSaveState(error ? "error" : "saved");
  }

  async function exportMyData() {
    if (!userId) return;
    setExporting(true);
    try {
      const [thesesResult, callsResult] = await Promise.all([
        supabase.from("floor_theses").select("*").eq("author_id", userId),
        supabase.from("floor_calls").select("*").eq("author_id", userId),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        theses: thesesResult.data ?? [],
        calls: callsResult.data ?? [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `the-floor-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="floor-settings-page">
      <header>
        <p className="floor-kicker">The Floor Settings</p>
        <h1>Membership and billing</h1>
        <p>Review your Floor access, renewal status, and Stripe billing options.</p>
      </header>

      <section className="floor-settings-card">
        <div className="floor-settings-icon"><CreditCard aria-hidden="true" /></div>
        <div className="floor-settings-copy">
          <span>Current membership</span>
          <h2>{loading ? "Checking membership…" : subscription ? planName(subscription.plan_key) : isAdmin ? "Administrator access" : "Membership required"}</h2>
          <p>{subscription ? `Status: ${subscription.status.replaceAll("_", " ")}` : isAdmin ? "The Floor is included with administrator access." : "Choose a Floor membership before entering the research platform."}</p>
          {subscription?.current_period_end ? <small>Current period ends {new Date(subscription.current_period_end).toLocaleDateString()}.</small> : null}
        </div>
        <div className="floor-settings-actions">
          {subscription?.stripe_subscription_id ? (
            <BillingPortalButton subscriptionId={subscription.stripe_subscription_id}>Manage subscription</BillingPortalButton>
          ) : null}
          <Link href="/support"><ExternalLink aria-hidden="true" /> Billing support</Link>
        </div>
      </section>

      <section className="floor-settings-plans" aria-label="The Floor subscription options">
        <header><span>Subscription options</span><h2>Monthly or annual access</h2></header>
        <div>
          <article data-current={subscription?.plan_key === "floor_monthly" ? "true" : "false"}>
            <span>Monthly</span><strong>$19.99</strong><small>per month</small>
            {subscription?.plan_key === "floor_monthly" ? <b>Current plan</b> : subscription?.stripe_subscription_id ? <BillingPortalButton subscriptionId={subscription.stripe_subscription_id} action="update" variant="secondary">Switch to monthly</BillingPortalButton> : isAdmin ? <p>Included with administrator access.</p> : <Link href="/the-floor/subscribe">Choose monthly</Link>}
          </article>
          <article data-current={subscription?.plan_key === "floor_annual" ? "true" : "false"}>
            <span>Annual</span><strong>$199</strong><small>per year · save $40.88</small>
            {subscription?.plan_key === "floor_annual" ? <b>Current plan</b> : subscription?.stripe_subscription_id ? <BillingPortalButton subscriptionId={subscription.stripe_subscription_id} action="update" variant="secondary">Switch to annual</BillingPortalButton> : isAdmin ? <p>Included with administrator access.</p> : <Link href="/the-floor/subscribe">Choose annual</Link>}
          </article>
        </div>
      </section>

      {userId ? (
        <>
          <section className="floor-settings-section" aria-label="Notifications and alerts">
            <header>
              <span>Notifications</span>
              <h2>Notifications &amp; alerts</h2>
              <p>Control what The Floor notifies you about, and how.</p>
            </header>

            <div className="floor-settings-row">
              <div className="floor-settings-row-copy">
                <strong>Falsification alerts</strong>
                <span>Notify me when a falsifiable call I made is due for resolution.</span>
              </div>
              <Toggle
                label="Falsification alerts"
                checked={preferences.falsification_alerts_enabled}
                onChange={(value) => void updatePreferences({ falsification_alerts_enabled: value })}
              />
            </div>

            <div className="floor-settings-row">
              <div className="floor-settings-row-copy">
                <strong>Alert channel</strong>
                <span>Where alerts and reminders are delivered.</span>
              </div>
              <select
                className="floor-settings-select"
                value={preferences.alert_channel}
                onChange={(event) => void updatePreferences({ alert_channel: event.target.value as AlertChannel })}
              >
                <option value="in_app">In-app only</option>
                <option value="email">Email only</option>
                <option value="both">In-app and email</option>
              </select>
            </div>

            <div className="floor-settings-row">
              <div className="floor-settings-row-copy">
                <strong>The Weave digest</strong>
                <span>The weekly digest of Floor activity and highlighted theses.</span>
              </div>
              <select
                className="floor-settings-select"
                value={preferences.weave_digest}
                onChange={(event) => void updatePreferences({ weave_digest: event.target.value as WeaveDigest })}
              >
                <option value="weekly">Weekly</option>
                <option value="off">Off</option>
              </select>
            </div>

            <div className="floor-settings-row">
              <div className="floor-settings-row-copy">
                <strong>Earnings reminders</strong>
                <span>Remind me before earnings for companies I&apos;ve published theses on.</span>
              </div>
              <Toggle
                label="Earnings reminders"
                checked={preferences.earnings_reminders_enabled}
                onChange={(value) => void updatePreferences({ earnings_reminders_enabled: value })}
              />
            </div>

            <div className="floor-settings-row">
              <div className="floor-settings-row-copy">
                <strong>Resolution reminders</strong>
                <span>Remind me when one of my calls is approaching its resolution date.</span>
              </div>
              <Toggle
                label="Resolution reminders"
                checked={preferences.resolution_reminders_enabled}
                onChange={(value) => void updatePreferences({ resolution_reminders_enabled: value })}
              />
            </div>

            <div className="floor-settings-row">
              <div className="floor-settings-row-copy">
                <strong>Calibration nudges</strong>
                <span>Occasional prompts encouraging well-calibrated conviction levels.</span>
              </div>
              <Toggle
                label="Calibration nudges"
                checked={preferences.calibration_nudge_enabled}
                onChange={(value) => void updatePreferences({ calibration_nudge_enabled: value })}
              />
            </div>
          </section>

          <section className="floor-settings-section" aria-label="Display defaults">
            <header>
              <span>Display</span>
              <h2>Display defaults</h2>
              <p>Defaults used when opening charts or composing a new call.</p>
            </header>

            <div className="floor-settings-row">
              <div className="floor-settings-row-copy">
                <strong>Default chart timeframe</strong>
                <span>Applied when you open a company or market chart.</span>
              </div>
              <select
                className="floor-settings-select"
                value={preferences.default_chart_timeframe}
                onChange={(event) => void updatePreferences({ default_chart_timeframe: event.target.value as ChartTimeframe })}
              >
                <option value="1d">1 day</option>
                <option value="1w">1 week</option>
                <option value="1m">1 month</option>
                <option value="ytd">Year to date</option>
              </select>
            </div>

            <div className="floor-settings-row">
              <div className="floor-settings-row-copy">
                <strong>Default call horizon</strong>
                <span>Pre-selected horizon when composing a new falsifiable call.</span>
              </div>
              <select
                className="floor-settings-select"
                value={preferences.default_call_horizon ?? ""}
                onChange={(event) => void updatePreferences({ default_call_horizon: event.target.value || null })}
              >
                <option value="">No default</option>
                {FLOOR_HORIZON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="floor-settings-row">
              <div className="floor-settings-row-copy">
                <strong>Default call comparator</strong>
                <span>Pre-selected comparator when composing a new falsifiable call.</span>
              </div>
              <select
                className="floor-settings-select"
                value={preferences.default_call_comparator ?? ""}
                onChange={(event) => void updatePreferences({ default_call_comparator: event.target.value || null })}
              >
                <option value="">No default</option>
                {FLOOR_COMPARATOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="floor-settings-section" aria-label="Track record and privacy">
            <header>
              <span>Privacy</span>
              <h2>Track record &amp; privacy</h2>
              <p>Your calls always count toward your own accountability record. This only controls whether other members can find you on the public leaderboard.</p>
            </header>

            <div className="floor-settings-row">
              <div className="floor-settings-row-copy">
                <strong>Show on leaderboard</strong>
                <span>Appear in the public analyst credibility leaderboard.</span>
              </div>
              <Toggle
                label="Show on leaderboard"
                checked={preferences.show_on_leaderboard}
                onChange={(value) => void updatePreferences({ show_on_leaderboard: value })}
              />
            </div>

            <div className="floor-settings-row">
              <div className="floor-settings-row-copy">
                <strong>Leaderboard display</strong>
                <span>How your name appears on the leaderboard, when shown.</span>
              </div>
              <select
                className="floor-settings-select"
                value={preferences.leaderboard_display}
                onChange={(event) => void updatePreferences({ leaderboard_display: event.target.value as LeaderboardDisplay })}
              >
                <option value="username">Username</option>
                <option value="full_name">Full name</option>
              </select>
            </div>

            <div className="floor-settings-row">
              <div className="floor-settings-row-copy">
                <strong>Download your data</strong>
                <span>Export every thesis and call you&apos;ve published on The Floor as JSON.</span>
              </div>
              <button type="button" className="floor-settings-export" onClick={() => void exportMyData()} disabled={exporting}>
                <Download aria-hidden="true" /> {exporting ? "Preparing…" : "Export"}
              </button>
            </div>

            {saveState !== "idle" ? (
              <p className="floor-settings-save-state">
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved." : "Could not save. Try again."}
              </p>
            ) : null}
          </section>
        </>
      ) : null}

      <section className="floor-settings-standard">
        <ShieldCheck aria-hidden="true" />
        <div><h2>Research standard</h2><p>The Floor provides informational and educational research tools. It does not provide personalized investment advice.</p></div>
      </section>
    </main>
  );
}
