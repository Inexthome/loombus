import type { Metadata } from "next";
import AdminTeenSafetyClient from "./admin-teen-safety-client";
import "./admin-teen-safety.css";

export const metadata: Metadata = {
  title: "Teen Safety Operations | Loombus",
  description: "Admin-only review of age corrections, underage account reports, and teen migration exceptions.",
  robots: { index: false, follow: false },
};

export default function AdminTeenSafetyPage() {
  return <AdminTeenSafetyClient />;
}
