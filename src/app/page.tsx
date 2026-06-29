import type { Metadata } from "next";
import { V2PublicLanding } from "./v2-public-landing";

export const metadata: Metadata = {
  title: "Loombus | Signal over noise",
  description:
    "Loombus is a signal-first discussion platform for thoughtful conversations, sharper ideas, and cleaner community dialogue.",
  alternates: {
    canonical: "https://loombus.com/",
  },
};

export default function RootPage() {
  return <V2PublicLanding />;
}
