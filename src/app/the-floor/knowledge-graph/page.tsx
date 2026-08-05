import type { Metadata } from "next";
import TheFloorKnowledgeGraph from "@/components/the-floor-knowledge-graph";

export const metadata: Metadata = {
  title: "Research Knowledge Graph | The Floor | Loombus",
  description:
    "Explore connected companies, analysts, theses, catalysts, risks, themes, and evidence across The Floor.",
};

export default function TheFloorKnowledgeGraphPage() {
  return <TheFloorKnowledgeGraph />;
}
