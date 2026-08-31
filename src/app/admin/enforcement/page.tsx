import type { Metadata } from "next";
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
  return <AdminEnforcementClient />;
}
