import type { ReactNode } from "react";
import "./public-reference.css";

type PageShellProps = {
  children: ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const widthClass = {
  sm: "max-w-xl",
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

export function PageShell({
  children,
  width = "lg",
  className = "",
}: PageShellProps) {
  return (
    <main className={`loombus-page-shell-v2 ${className}`}>
      <div className={`loombus-page-shell-v2-inner ${widthClass[width]}`}>
        {children}
      </div>
    </main>
  );
}
