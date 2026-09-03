import type { Metadata } from "next";
import EmailUnsubscribeClient from "./unsubscribe-client";

export const metadata: Metadata = {
  title: "Email Preferences | Loombus",
  description: "Manage Loombus email preferences.",
  robots: { index: false, follow: false },
};

export default function EmailUnsubscribePage() {
  return <EmailUnsubscribeClient />;
}
