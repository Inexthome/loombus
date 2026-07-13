import type { Metadata } from "next";
import SafetyV2Client from "./safety-v2-client";
import "./safety-v2.css";

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
  return <SafetyV2Client />;
}
