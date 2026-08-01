import type { ReactNode } from "react";
import TheFloorShell from "@/components/the-floor-shell";
import "./the-floor-shell.css";

export default function TheFloorLayout({ children }: { children: ReactNode }) {
  return <TheFloorShell>{children}</TheFloorShell>;
}
