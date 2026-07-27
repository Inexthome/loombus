import type { Metadata } from "next";
import AgeSafetyClient from "./age-safety-client";
import "./age-safety.css";

export const metadata: Metadata = {
  title: "Age Safety | Loombus",
  description: "Review age state, teen privacy protections, and date-of-birth correction requests.",
  robots: { index: false, follow: false },
};

export default function AgeSafetyPage() {
  return <AgeSafetyClient />;
}
