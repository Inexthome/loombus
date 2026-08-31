import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LibraryImmersiveSubappShell } from "@/components/library/library-immersive-subapp-shell";
import "./library-theme.css";
import "./library-immersive-shell.css";
import "./library-original-background.css";

export const metadata: Metadata = {
  title: "Library",
  description:
    "Read publications, highlight passages, keep private notes, and move ideas from a passage into structured discussion, evidence, and knowledge.",
  openGraph: {
    title: "Library | Loombus",
    description:
      "Read publications, highlight passages, and move ideas into structured discussion, evidence, and knowledge.",
    url: "https://loombus.com/library",
  },
  twitter: {
    title: "Library | Loombus",
    description:
      "Read publications, highlight passages, and move ideas into structured discussion, evidence, and knowledge.",
  },
};

export default function LibraryLayout({ children }: { children: ReactNode }) {
  return (
    <div data-loombus-library>
      <LibraryImmersiveSubappShell>{children}</LibraryImmersiveSubappShell>
    </div>
  );
}
