import type { Metadata } from "next";
import Home from "./home/page";

export const metadata: Metadata = {
  title: "Loombus | Signal over noise",
  description:
    "Loombus is a signal-first discussion platform for thoughtful conversations, sharper ideas, and cleaner community dialogue.",
  alternates: {
    canonical: "https://loombus.com/",
  },
};

export default function RootPage() {
  return <Home />;
}
