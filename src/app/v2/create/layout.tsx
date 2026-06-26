import type { ReactNode } from "react";
import styles from "./theme.module.css";

export default function V2CreateLayout({ children }: { children: ReactNode }) {
  return <div className={styles.scope}>{children}</div>;
}
