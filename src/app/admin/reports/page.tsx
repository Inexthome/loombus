import type { Metadata } from "next";
import ReportsV2Client from "./reports-v2-client";
import "./reports-v2.css";

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
  return <ReportsV2Client />;
}
