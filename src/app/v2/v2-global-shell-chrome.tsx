"use client";

import { usePathname } from "next/navigation";
import { V2ShellMobileNav, V2ShellTopNav } from "./v2-shell-components";

const ENTRY_PATHS = new Set(["/v2/login", "/v2/signup", "/v2/reset-password"]);

export function V2GlobalShellChrome() {
  const pathname = usePathname() ?? "";

  if (ENTRY_PATHS.has(pathname)) {
    return null;
  }

  return (
    <>
      <V2ShellTopNav />
      <V2ShellMobileNav />
    </>
  );
}
