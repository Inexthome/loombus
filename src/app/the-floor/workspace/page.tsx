import type { Metadata } from "next";
import TheFloorResearchWorkspace from "@/components/the-floor-research-workspace";

export const metadata: Metadata = {
  title: "Research Workspace | The Floor",
  description: "Build private, evidence-backed investment research with quality scoring and revision history.",
};

export default function TheFloorWorkspacePage() {
  return <TheFloorResearchWorkspace />;
}
