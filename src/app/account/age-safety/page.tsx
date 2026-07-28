import type { Metadata } from "next";
import AgeSafetyClient from "./age-safety-client";

export const metadata: Metadata = {
  title: "Age Safety | Loombus",
  description: "Review age-safety protections, request an age correction, or report an underage account.",
  robots: { index: false, follow: false },
};

export default function AgeSafetyPage() {
  return <AgeSafetyClient />;
}
