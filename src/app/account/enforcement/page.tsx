import type { Metadata } from "next";
import AccountEnforcementClient from "./account-enforcement-client";
import "./account-enforcement.css";

export const metadata: Metadata = {
  title: "Account Decisions and Appeals | Loombus",
  description:
    "Review Loombus enforcement decisions, current access effects, appeal eligibility, and appeal status.",
  robots: { index: false, follow: false },
};

export default function AccountEnforcementPage() {
  return <AccountEnforcementClient />;
}
