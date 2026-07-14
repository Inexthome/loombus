import type { Metadata } from "next";
import AdminAiAccessV2Client from "./ai-access-v2-client";
import "./ai-access-v2.css";

export const metadata: Metadata = {
  title: "AI Access Operations | Loombus Admin",
  description:
    "Admin workspace for reviewing Loombus AI entitlements and recent AI usage diagnostics.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminAiAccessPage() {
  return <AdminAiAccessV2Client />;
}
