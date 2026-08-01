"use client";

import { Check, ShieldCheck } from "lucide-react";
import { PremiumPlanCheckoutButton } from "@/app/premium/premium-checkout-button";

export default function TheFloorSubscriptionCard({
  checkout,
  access,
}: {
  checkout?: string;
  access?: string;
}) {
  return (
    <section className="floor-subscription-card" aria-label="The Floor subscription">
      <div className="floor-subscription-copy">
        <p className="floor-kicker">The Floor Membership</p>
        <h2>{access === "subscribe" ? "This research area is for Floor members." : "Go beyond the market overview."}</h2>
        <p>
          Follow exclusive Loombus research, analyst activity, live programming,
          completed Academy courses, and resolved track records in one accountable workspace.
        </p>
        {checkout === "success" ? (
          <div className="floor-subscription-notice floor-subscription-success">
            Checkout completed. Your Floor access is being activated.
          </div>
        ) : checkout === "cancelled" || checkout === "canceled" ? (
          <div className="floor-subscription-notice">Checkout was canceled. No charge was made.</div>
        ) : null}
        <ul>
          <li><Check aria-hidden="true" /> 7-day free trial</li>
          <li><Check aria-hidden="true" /> Secure Stripe billing</li>
          <li><ShieldCheck aria-hidden="true" /> Research only, not investment advice</li>
        </ul>
      </div>
      <div className="floor-subscription-plans">
        <article>
          <span>Monthly</span>
          <strong>$19.99</strong>
          <small>per month after trial</small>
          <PremiumPlanCheckoutButton planKey="floor_monthly">Start free trial</PremiumPlanCheckoutButton>
        </article>
        <article className="floor-subscription-best">
          <span>Annual · save $40.88</span>
          <strong>$199</strong>
          <small>per year after trial</small>
          <PremiumPlanCheckoutButton planKey="floor_annual">Start annual trial</PremiumPlanCheckoutButton>
        </article>
      </div>
    </section>
  );
}
