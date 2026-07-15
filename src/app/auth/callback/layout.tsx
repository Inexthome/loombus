import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Finishing sign-in | Loombus",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthCallbackLayout({ children }: { children: ReactNode }) {
  return children;
}
