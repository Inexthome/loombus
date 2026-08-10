import type { ReactNode } from "react";
import "./library-theme.css";

export default function LibraryLayout({ children }: { children: ReactNode }) {
  return <div data-loombus-library>{children}</div>;
}
