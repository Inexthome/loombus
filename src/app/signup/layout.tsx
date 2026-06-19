import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Create an account | Loombus",
  description:
    "Create a Loombus account and join a platform built for thoughtful discussions instead of endless scrolling.",
  alternates: {
    canonical: "https://loombus.com/signup",
  },
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
