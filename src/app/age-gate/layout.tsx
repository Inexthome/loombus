import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Account verification | Loombus",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AgeGateLayout({ children }: { children: ReactNode }) {
  return children;
}
