import type { Metadata } from "next";
import TheFloorExperience from "@/components/the-floor-experience";
import TheFloorPage from "@/components/the-floor-page";

export const metadata: Metadata = {
  title: "The Floor | Loombus",
  description:
    "Research investment ideas, challenge the reasoning, track falsifiable calls, and study transparent outcomes on The Floor by Loombus.",
};

export default function TheFloorRoute() {
  return (
    <TheFloorExperience>
      <TheFloorPage />
    </TheFloorExperience>
  );
}
