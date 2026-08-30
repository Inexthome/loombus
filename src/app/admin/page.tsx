import type { Metadata } from "next";
import { AdminQuestionOfWeekLinkBridge } from "@/components/admin-question-of-week-link-bridge";
import AdminOperationsClient from "./admin-operations-client";
import "./admin-operations.css";

export const metadata: Metadata = {
  title: "Admin Operations | Loombus",
  description:
    "Role-protected Loombus administration for moderation, support, members, platform operations, publishing, legal workflows, and diagnostics.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminDashboardPage() {
  return (
    <>
      <AdminQuestionOfWeekLinkBridge />
      <AdminOperationsClient />
    </>
  );
}
