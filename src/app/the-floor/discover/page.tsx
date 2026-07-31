import TheFloorDiscovery from "@/components/the-floor-discovery";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Graph-Powered Discovery | The Floor",
  description: "Discover companies, themes, risks, catalysts, and research momentum through The Floor's evidence-backed knowledge graph.",
};

export default function TheFloorDiscoverPage() {
  return <TheFloorDiscovery />;
}
