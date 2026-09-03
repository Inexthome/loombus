import type { Metadata } from "next";
import AdminCommunicationsClient from "./communications-client";

export const metadata: Metadata = {
  title: "Member Communications | Loombus Admin",
  description: "Prepare, send, and audit role-protected Loombus member email campaigns.",
  robots: { index: false, follow: false },
};

export default function AdminCommunicationsPage() {
  return <AdminCommunicationsClient />;
}
