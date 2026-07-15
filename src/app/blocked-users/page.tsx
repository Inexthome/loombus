import type { Metadata } from "next";
import BlockedUsersV2Client from "./blocked-users-v2-client";
import "./blocked-users-v2.css";

export const metadata: Metadata = {
  title: "Blocked Members | Loombus",
  description:
    "Review and manage the members blocked from your Loombus account.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "https://loombus.com/blocked-users",
  },
};

export default function BlockedUsersPage() {
  return <BlockedUsersV2Client />;
}
