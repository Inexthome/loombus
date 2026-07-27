import type { Metadata } from "next";
import RoomMinorSafetyClient from "./room-minor-safety-client";
import "./room-minor-safety.css";

export const metadata: Metadata = {
  title: "Room Minor Safety | Loombus",
  description: "Owner and administrator controls for teen participation in a private Loombus Room.",
  robots: { index: false, follow: false },
};

export default function RoomMinorSafetyPage() {
  return <RoomMinorSafetyClient />;
}
