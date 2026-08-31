import type { Metadata } from "next";
import type { ReactNode } from "react";
import TheFloorShell from "@/components/the-floor-shell";
import "./the-floor-shell.css";
import "./the-floor-mobile-safe-area.css";
import "./the-floor-original-background.css";

export const metadata: Metadata = {
  title: "The Floor",
  description:
    "Research investment ideas, develop theses, examine evidence, and learn with others on The Floor by Loombus.",
  openGraph: {
    title: "The Floor | Loombus",
    description:
      "Research investment ideas, develop theses, examine evidence, and learn with others on The Floor by Loombus.",
    url: "https://loombus.com/the-floor",
  },
  twitter: {
    title: "The Floor | Loombus",
    description:
      "Research investment ideas, develop theses, examine evidence, and learn with others.",
  },
};

export default function TheFloorLayout({ children }: { children: ReactNode }) {
  return <TheFloorShell>{children}</TheFloorShell>;
}
