import type { Metadata } from "next";
import RoomGovernanceClient from "./room-governance-client";

export const metadata: Metadata = {
  title: "Room Governance | Loombus",
  description:
    "Manage Room ownership, roles, moderation, retention, policies, and audit history.",
  robots: { index: false, follow: false },
};

export default function RoomGovernancePage() {
  return <RoomGovernanceClient />;
}
