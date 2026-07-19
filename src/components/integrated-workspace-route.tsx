"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const INTEGRATED_WORKSPACE_ROOTS = [
  "/local",
  "/businesses",
  "/services",
  "/jobs",
  "/marketplace",
  "/appointments",
  "/events",
  "/requests",
] as const;

type IntegratedWorkspaceMode = "index" | "workspace" | "detail" | "safety";

function getIntegratedWorkspaceRoot(pathname: string) {
  return INTEGRATED_WORKSPACE_ROOTS.find(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

function getIntegratedWorkspaceMode(
  pathname: string,
  root: (typeof INTEGRATED_WORKSPACE_ROOTS)[number],
): IntegratedWorkspaceMode {
  const relativePath = pathname.slice(root.length);
  const routeSegments = relativePath.split("/").filter(Boolean);

  if (routeSegments.includes("safety")) {
    return "safety";
  }

  if (
    root === "/appointments" ||
    routeSegments.includes("manage") ||
    routeSegments.includes("saved")
  ) {
    return "workspace";
  }

  return routeSegments.length === 0 ? "index" : "detail";
}

export function IntegratedWorkspaceRoute({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const routeRoot = getIntegratedWorkspaceRoot(pathname);

  if (!routeRoot) {
    return children;
  }

  const mode = getIntegratedWorkspaceMode(pathname, routeRoot);

  return (
    <div
      className={`loombus-integrated-workspace-route loombus-integrated-workspace-${mode}`}
      data-loombus-workspace-root={routeRoot.slice(1)}
      data-loombus-workspace-mode={mode}
    >
      {children}
    </div>
  );
}
