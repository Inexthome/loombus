import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Login to Loombus | Loombus",
  description:
    "Login to Loombus to continue your discussions, replies, saved ideas, and community activity.",
  alternates: {
    canonical: "https://loombus.com/login",
  },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
