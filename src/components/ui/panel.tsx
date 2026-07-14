import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  className?: string;
  tone?: "default" | "warning" | "danger";
};

const toneClass = {
  default: "",
  warning: "text-amber-700 dark:text-amber-200",
  danger: "text-red-700 dark:text-red-200",
};

export function Panel({
  children,
  className = "",
  tone = "default",
}: PanelProps) {
  return (
    <section className={`loombus-panel-v2 ${toneClass[tone]} ${className}`}>
      {children}
    </section>
  );
}
