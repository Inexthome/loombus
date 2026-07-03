import styles from "./rooms-light-contrast.module.css";

export default function V2RoomsLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.roomsContrastScope}>{children}</div>;
}
