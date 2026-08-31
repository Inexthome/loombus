import type { Metadata } from "next";
import Link from "next/link";
import { AdminTrustSafetyEditorialFrame } from "../admin-trust-safety-editorial-frame";
import ReportsV2Client from "./reports-v2-client";
import "./reports-v2.css";
import "../trust-safety-editorial.css";

export const metadata: Metadata = {
  title: "Reports | Loombus Admin",
  description:
    "Admin moderation queue for reviewing Loombus reports and recorded outcomes.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminReportsPage() {
  return (
    <AdminTrustSafetyEditorialFrame
      active="reports"
      eyebrow="Trust, safety & moderation"
      title="Reports"
      description="Review member-submitted reports, inspect the available context, record a decision, and move through the moderation queue without losing the evidence trail."
      utility={
        <Link href="/admin/reports/trust-safety">
          Restricted Trust & Safety cases
        </Link>
      }
    >
      <ReportsV2Client />
    </AdminTrustSafetyEditorialFrame>
  );
}
