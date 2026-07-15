import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Reset your password | Loombus",
  description: "Request a secure password reset link for your Loombus account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
