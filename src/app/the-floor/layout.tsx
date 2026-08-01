import type { ReactNode } from "react";
import TheFloorShell from "@/components/the-floor-shell";
import "./floor-shell.css";

export default function FloorLayout({ children }: { children: ReactNode }) {
  return <TheFloorShell>{children}</TheFloorShell>;
}
