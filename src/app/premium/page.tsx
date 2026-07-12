import type { Metadata } from "next";
import { Suspense } from "react";
import PremiumV2Client from "./premium-v2-client";
import "./premium-v2.css";

export const metadata: Metadata = {
  title: "Loombus Premium & Plans | Loombus",
  description:
    "Review your current Loombus plan, Premium options, AI access, and supported billing-management paths.",
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "https://loombus.com/premium",
  },
};

export default function PremiumPage() {
  return (
    <Suspense
      fallback={
        <main className="premium-v2-page">
          <section className="premium-v2-state">
            <p>Loombus plans</p>
            <h1>Loading Premium & Plan Center…</h1>
          </section>
        </main>
      }
    >
      <PremiumV2Client />
    </Suspense>
  );
}
