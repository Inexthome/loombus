import type { Metadata } from "next";
import { AdminTrustSafetyEditorialFrame } from "../admin-trust-safety-editorial-frame";
import SafetyV2Client from "./safety-v2-client";
import "./safety-v2.css";
import "../trust-safety-editorial.css";

export const metadata: Metadata = {
  title: "Safety Operations | Loombus Admin",
  description:
    "Admin safety operations workspace for reviewing pre-submit blocks, warnings, and repeated safety signals.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminSafetyPage() {
  return (
    <AdminTrustSafetyEditorialFrame
      active="safety"
      eyebrow="Trust, safety & moderation"
      title="Safety Queue"
      description="Review pre-submit safety blocks, warnings, repeated signals, and the supporting context used to decide what requires administrator attention."
    >
      <SafetyV2Client />
    </AdminTrustSafetyEditorialFrame>
  );
}
