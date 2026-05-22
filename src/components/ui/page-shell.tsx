import type { ReactNode } from "react";

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
    <main className={`min-h-screen bg-black px-6 py-16 text-white ${className}`}>
      <div className={`mx-auto ${widthClass[width]}`}>
        {children}
      </div>
    </main>
  );
}
