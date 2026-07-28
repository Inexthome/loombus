import type { Metadata } from "next";
import AdminAgeSafetyClient from "./admin-age-safety-client";

export const metadata: Metadata = {
  title: "Age Safety Operations | Loombus",
  description: "Admin review for age corrections and underage-account reports.",
  robots: { index: false, follow: false },
};

export default function AdminAgeSafetyPage() {
  return <AdminAgeSafetyClient />;
}
