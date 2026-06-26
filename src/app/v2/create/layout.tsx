import type { ReactNode } from "react";
import "./theme.css";

export default function V2CreateLayout({ children }: { children: ReactNode }) {
  return <div data-loombus-v2-create-theme>{children}</div>;
}
