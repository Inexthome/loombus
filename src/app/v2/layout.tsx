import type { ReactNode } from "react";
import { V2ShellLinkRouter } from "./v2-shell-link-router";

export default function V2Layout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <V2ShellLinkRouter />
    </>
  );
}
