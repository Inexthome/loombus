import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  className?: string;
  tone?: "default" | "warning" | "danger";
};

const toneClass = {
  default: "border-zinc-800 bg-zinc-950",
  warning: "border-amber-900/60 bg-amber-950/20 text-amber-200",
  danger: "border-red-900/60 bg-red-950/20",
};

export function Panel({
  children,
  className = "",
  tone = "default",
}: PanelProps) {
  return (
    <section className={`rounded-3xl border p-7 ${toneClass[tone]} ${className}`}>
      {children}
    </section>
  );
}
