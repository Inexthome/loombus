import type { Metadata } from "next";
import AdminAuditV2Client from "./audit-v2-client";
import "./audit-v2.css";

export const metadata: Metadata = {
  title: "Audit Operations | Loombus Admin",
  description: "Admin workspace for tracing Loombus platform, moderation, and safety events.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminAuditPage() {
  return <AdminAuditV2Client />;
}
