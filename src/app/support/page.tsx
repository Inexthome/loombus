import type { Metadata } from "next";
import SupportV2Client from "./support-v2-client";
import "./support-v2.css";

export const metadata: Metadata = {
  title: "Help & Support",
  description:
    "Search Loombus help, open platform guidance, and submit a structured support request.",
};

export default function SupportPage() {
  return <SupportV2Client />;
}
