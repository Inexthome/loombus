import type { ReactNode } from "react";

type V2FeatureRouteShellProps = {
  children: ReactNode;
};

export default function V2FeatureRouteShell({
  children,
}: V2FeatureRouteShellProps) {
  return (
    <div
      data-loombus-v2-feature-shell
      className="min-h-screen w-full bg-[var(--loombus-page-bg)] text-[var(--loombus-text)] [&_.loombus-shell-with-right-rail]:!pr-0"
    >
      {children}
    </div>
  );
}
