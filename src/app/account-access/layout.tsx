import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Account access | Loombus",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountAccessLayout({ children }: { children: ReactNode }) {
  return children;
}
