import type { Metadata } from "next";
import { Suspense } from "react";
import PremiumV3Client from "./premium-v3-client";
import "./premium-v2.css";
import "./premium-v3.css";
import "./premium-editorial.css";

export const metadata: Metadata = {
  title: "Loombus Premium & Plans | Loombus",
  description:
    "Compare Loombus Free, Premium, and Premium Pro access, AI allowances, professional tools, and current Early Access launch pricing.",
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
    <div data-premium-editorial>
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
        <PremiumV3Client />
      </Suspense>
    </div>
  );
}
