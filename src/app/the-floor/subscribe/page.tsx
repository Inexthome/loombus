import type { Metadata } from "next";
import TheFloorSubscriptionCard from "@/components/the-floor-subscription-card";

export const metadata: Metadata = {
  title: "Join The Floor | Loombus",
  description: "Choose monthly or annual access to The Floor by Loombus.",
};

export default async function FloorSubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ access?: string; checkout?: string }>;
}) {
  const query = await searchParams;
  return <TheFloorSubscriptionCard access={query.access} checkout={query.checkout} />;
}
