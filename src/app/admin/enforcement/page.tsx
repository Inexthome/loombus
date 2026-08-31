import type { Metadata } from "next";
import { AdminTrustSafetyEditorialFrame } from "../admin-trust-safety-editorial-frame";
import AdminEnforcementClient from "./admin-enforcement-client";
import "./admin-enforcement.css";
import "../trust-safety-editorial.css";

export const metadata: Metadata = {
  title: "Enforcement and Appeals Operations | Loombus",
  description:
    "Admin-only review of Loombus enforcement decisions, member appeals, reviewer conflicts, and restoration outcomes.",
  robots: { index: false, follow: false },
};

export default function AdminEnforcementPage() {
  return (
    <AdminTrustSafetyEditorialFrame
      active="enforcement"
      eyebrow="Trust, safety & moderation"
      title="Enforcement & Appeals"
      description="Review enforcement decisions, member consequences, appeals, reviewer conflicts, and restoration outcomes as one continuous decision record."
    >
      <AdminEnforcementClient />
    </AdminTrustSafetyEditorialFrame>
  );
}
