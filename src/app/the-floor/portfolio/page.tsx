import type { Metadata } from "next";
import TheFloorPortfolioIntelligence from "@/components/the-floor-portfolio-intelligence";

export const metadata: Metadata = {
  title: "Portfolio Intelligence | The Floor | Loombus",
  description:
    "A private research workspace for portfolio concentration, company coverage, watchlists, and thesis alignment on The Floor.",
};

export default function TheFloorPortfolioPage() {
  return <TheFloorPortfolioIntelligence />;
}
