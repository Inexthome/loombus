import type { Metadata } from "next";
import CompanyIntelligencePage from "@/components/the-floor-company-intelligence";
import { getFloorCompany } from "@/lib/floor-companies";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params;
  const company = getFloorCompany(ticker);
  return {
    title: `${company.name} (${company.ticker}) | The Floor`,
    description: `Transparent research, bull and bear cases, timeline, and accountable outcomes for ${company.name} on The Floor by Loombus.`,
  };
}

export default async function FloorCompanyRoute({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return <CompanyIntelligencePage ticker={ticker} />;
}
