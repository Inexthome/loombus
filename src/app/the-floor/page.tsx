import type { Metadata } from "next";
import TheFloorOpeningBell from "@/components/the-floor-opening-bell";
import TheFloorPage from "@/components/the-floor-page";
import TheFloorSubscriptionCard from "@/components/the-floor-subscription-card";

export const metadata: Metadata = {
  title: "The Floor | Loombus",
  description:
    "Research investment ideas, challenge the reasoning, track falsifiable calls, and study transparent outcomes on The Floor by Loombus.",
};

export default async function TheFloorRoute({
  searchParams,
}: {
  searchParams: Promise<{ access?: string; checkout?: string }>;
}) {
  const query = await searchParams;
  return (
    <>
      <TheFloorOpeningBell />
      <TheFloorPage />
      <TheFloorSubscriptionCard access={query.access} checkout={query.checkout} />
    </>
  );
}
