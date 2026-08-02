import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "The Floor | Loombus",
  description:
    "Research investment ideas, challenge the reasoning, track falsifiable calls, and study transparent outcomes on The Floor by Loombus.",
};

export default function TheFloorRoute() {
  redirect("/the-floor/discussion");
}
