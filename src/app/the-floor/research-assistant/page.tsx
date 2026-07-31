import type { Metadata } from "next";
import TheFloorResearchAssistant from "@/components/the-floor-research-assistant";

export const metadata: Metadata = {
  title: "Research Assistant | The Floor | Loombus",
  description: "Organize published Floor theses, disagreement, risks, catalysts, and resolved calls without issuing investment recommendations.",
};

export default function TheFloorResearchAssistantPage() {
  return <TheFloorResearchAssistant />;
}
