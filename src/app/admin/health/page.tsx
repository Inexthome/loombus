import type { Metadata } from "next";
import AdminHealthV2Client from "./health-v2-client";
import "./health-v2.css";

export const metadata: Metadata = {
  title: "Platform Health Operations | Loombus Admin",
  description:
    "Read-only Admin visibility across Loombus runtime configuration, database checks, AI activity, billing synchronization, email, and push delivery.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminHealthPage() {
  return <AdminHealthV2Client />;
}
