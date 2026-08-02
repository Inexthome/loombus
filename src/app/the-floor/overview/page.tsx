import type { Metadata } from "next";
import TheFloorOpeningBell from "@/components/the-floor-opening-bell";
import TheFloorPage from "@/components/the-floor-page";

export const metadata: Metadata = {
  title: "The Floor Overview | Loombus",
  description:
    "Review the market, accountable research, live programming, and activity across The Floor by Loombus.",
};

export default function TheFloorOverviewRoute() {
  return (
    <>
      <TheFloorOpeningBell />
      <TheFloorPage composerOnly />
    </>
  );
}
