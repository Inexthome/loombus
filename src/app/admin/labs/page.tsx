import type { Metadata } from "next";
import AdminLabsV2Client from "./labs-v2-client";
import "./labs-v2.css";

export const metadata: Metadata = {
  title: "Labs Operations | Loombus Admin",
  description:
    "Review Loombus Labs feature requests, member access, votes, statuses, and Admin notes.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLabsPage() {
  return <AdminLabsV2Client />;
}
