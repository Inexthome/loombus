import type { Metadata } from "next";
import TheFloorOpeningBell from "@/components/the-floor-opening-bell";
import TheFloorPage from "@/components/the-floor-page";

export const metadata: Metadata = {
  title: "The Floor | Loombus",
  description:
    "Research investment ideas, challenge the reasoning, track falsifiable calls, and study transparent outcomes on The Floor by Loombus.",
};

export default function TheFloorRoute() {
  return (
    <>
      <TheFloorOpeningBell />
      <TheFloorPage />
    </>
  );
}
