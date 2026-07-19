"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const INTEGRATED_WORKSPACE_ROUTES = new Set([
  "/local",
  "/businesses",
  "/services",
  "/services/manage",
  "/jobs",
  "/marketplace",
  "/marketplace/manage",
  "/marketplace/saved",
  "/appointments",
  "/events",
  "/events/manage",
  "/requests",
  "/requests/manage",
]);

export function IntegratedWorkspaceRoute({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const isIntegratedWorkspaceRoute = INTEGRATED_WORKSPACE_ROUTES.has(pathname);

  return (
    <div
      className={
        isIntegratedWorkspaceRoute
          ? "loombus-integrated-workspace-route"
          : undefined
      }
    >
      {children}
    </div>
  );
}
