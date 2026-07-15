import type { ReactNode } from "react";
import styles from "./reference-v2.module.css";

type PanelProps = {
  children: ReactNode;
  className?: string;
  tone?: "default" | "warning" | "danger";
};

const toneClass = {
  default: styles.panelDefault,
  warning: styles.panelWarning,
  danger: styles.panelDanger,
};

export function Panel({
  children,
  className = "",
  tone = "default",
}: PanelProps) {
  return (
    <section className={`${styles.panel} ${toneClass[tone]} ${className}`}>
      {children}
    </section>
  );
}
