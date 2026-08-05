import type { Metadata } from "next";
import RoomPollsClient from "./room-polls-client";
import styles from "./polls-page.module.css";

export const metadata: Metadata = {
  title: "Room Polls",
  description: "Private Room polls and organization voting.",
  robots: { index: false, follow: false },
};

export default function RoomPollsPage() {
  return (
    <div className={styles.pollsPage}>
      <RoomPollsClient />
    </div>
  );
}
