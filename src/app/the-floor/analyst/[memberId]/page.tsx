import TheFloorAnalystPage from "@/components/the-floor-analyst-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analyst Credibility | The Floor | Loombus",
  description: "An explainable Floor research track record built from published work and resolved outcomes.",
};

export default async function FloorAnalystRoute({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  return <TheFloorAnalystPage memberId={decodeURIComponent(memberId)} />;
}
