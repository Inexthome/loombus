import type { Metadata } from "next";
import RoomAgeSafetyClient from "./room-age-safety-client";

export const metadata: Metadata = {
  title: "Room Minor Safety | Loombus",
  description:
    "Configure protected admission for teen members and review the Room's minor-safety state.",
  robots: { index: false, follow: false },
};

export default function RoomAgeSafetyPage() {
  return <RoomAgeSafetyClient />;
}
