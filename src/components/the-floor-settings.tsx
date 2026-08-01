"use client";

import Link from "next/link";
import { CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { BillingPortalButton } from "@/components/billing-portal-button";
import { supabase } from "@/lib/supabase/client";

type FloorSubscription = {
  plan_key: "floor_monthly" | "floor_annual";
  status: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
};

function planName(plan: FloorSubscription["plan_key"]) {
  return plan === "floor_annual" ? "The Floor Annual" : "The Floor Monthly";
}

export default function TheFloorSettings() {
  const [subscription, setSubscription] = useState<FloorSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (mounted) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("floor_subscriptions")
        .select("plan_key,status,stripe_subscription_id,current_period_end")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (mounted) {
        setSubscription((data as FloorSubscription | null) ?? null);
        setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

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
          <h2>{loading ? "Checking membership…" : subscription ? planName(subscription.plan_key) : "Administrator access"}</h2>
          <p>{subscription ? `Status: ${subscription.status.replaceAll("_", " ")}` : "The Floor is included with administrator access."}</p>
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
            {subscription?.plan_key === "floor_monthly" ? <b>Current plan</b> : <p>Available through Stripe billing.</p>}
          </article>
          <article data-current={subscription?.plan_key === "floor_annual" ? "true" : "false"}>
            <span>Annual</span><strong>$199</strong><small>per year · save $40.88</small>
            {subscription?.plan_key === "floor_annual" ? <b>Current plan</b> : <p>Available through Stripe billing.</p>}
          </article>
        </div>
      </section>

      <section className="floor-settings-standard">
        <ShieldCheck aria-hidden="true" />
        <div><h2>Research standard</h2><p>The Floor provides informational and educational research tools. It does not provide personalized investment advice.</p></div>
      </section>
    </main>
  );
}
