import type { Metadata } from "next";
import LabsV2Client from "./labs-v2-client";
import "./labs-v2.css";

export const metadata: Metadata = {
  title: "Loombus Labs & Early Access | Loombus",
  description:
    "Submit Loombus feature requests, follow real review states, and use supported Premium Plus Labs voting.",
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "https://loombus.com/labs",
  },
};

export default function LabsPage() {
  return <LabsV2Client />;
}
