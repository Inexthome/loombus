import type { Metadata } from "next";
import { AdminTrustSafetyEditorialFrame } from "../admin-trust-safety-editorial-frame";
import AdminAuditV2Client from "./audit-v2-client";
import "./audit-v2.css";
import "../trust-safety-editorial.css";

export const metadata: Metadata = {
  title: "Audit Operations | Loombus Admin",
  description: "Admin workspace for tracing Loombus platform, moderation, and safety events.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminAuditPage() {
  return (
    <AdminTrustSafetyEditorialFrame
      active="audit"
      eyebrow="Trust, safety & moderation"
      title="Audit Log"
      description="Trace platform, moderation, and safety events through a chronological operational record with the actor, target, action, and recorded context kept together."
    >
      <AdminAuditV2Client />
    </AdminTrustSafetyEditorialFrame>
  );
}
