import type { Metadata } from "next";
import TheFloorResearchHub from "@/components/the-floor-research-hub";

export const metadata: Metadata = {
  title: "Research Hub | The Floor",
  description: "Private Floor watchlists, an auditable research journal, and structured research rooms.",
};

export default function TheFloorHubPage() {
  return <TheFloorResearchHub />;
}
