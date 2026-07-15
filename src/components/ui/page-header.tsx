import type { ReactNode } from "react";
import styles from "./reference-v2.module.css";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className = "",
}: PageHeaderProps) {
  return (
    <header className={`${styles.header} ${className}`}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <h1 className={styles.title}>{title}</h1>
      {description && <div className={styles.description}>{description}</div>}
      {children ? <div className={styles.headerChildren}>{children}</div> : null}
    </header>
  );
}
