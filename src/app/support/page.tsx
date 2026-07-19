import type { Metadata } from "next";
import SupportV2Client from "./support-v2-client";
import "./support-v2.css";

export const metadata: Metadata = {
  title: "Help & Support | Loombus",
  description:
    "Search Loombus help for discussions, Rooms, messages, Search Everything, AI, Local, businesses, services, requests, jobs, events, marketplace, appointments, matching, billing, safety, accessibility, and account access.",
  alternates: {
    canonical: "https://loombus.com/support",
  },
};

export default function SupportPage() {
  return <SupportV2Client />;
}
