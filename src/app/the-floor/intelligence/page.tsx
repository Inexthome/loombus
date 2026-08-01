import type { Metadata } from "next";
import TheFloorMarketIntelligence from "@/components/the-floor-market-intelligence";

export const metadata: Metadata = {
  title: "Market Intelligence | The Floor",
  description: "Earnings research, macro exposure, and sector dashboards grounded in observable Floor records.",
};

export default function TheFloorIntelligencePage() {
  return <TheFloorMarketIntelligence />;
}
