"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { PremiumPlanCheckoutButton } from "@/app/premium/premium-checkout-button";

export default function TheFloorSubscriptionCard({
  checkout,
  access,
}: {
  checkout?: string;
  access?: string;
}) {
  return (
    <main className="floor-subscription-landing">
      <header className="floor-subscription-brand">
        <Link href="/home"><ArrowLeft aria-hidden="true" /> Back to Loombus</Link>
        <div><Image src="/assets/brand/loombus-mark-transparent.png" alt="" width={42} height={42} /><span><strong>Loombus</strong><small>The Floor</small></span></div>
      </header>
    <section className="floor-subscription-card" aria-label="The Floor subscription">
      <div className="floor-subscription-copy">
        <p className="floor-kicker">The Floor Membership</p>
        <h1>{access === "subscribe" ? "Enter The Floor with a membership." : "Research the market. Test the thesis."}</h1>
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
        <aside className="floor-subscription-disclaimer">
          <ShieldCheck aria-hidden="true" />
          <p><strong>Important information.</strong> The Floor does not consider your investment objectives, financial circumstances, or individual needs and does not provide personalized investment advice. All content, research, education, data, and tools are provided for informational and educational purposes only. Loombus and The Floor are not registered securities dealers, broker-dealers, investment advisers, investment banks, or fiduciaries. Investing involves risk, including the possible loss of principal.</p>
        </aside>
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
    </main>
  );
}
