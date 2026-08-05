import type { Metadata } from "next";
import TheFloorEarningsCenter from "@/components/the-floor-earnings-center";

export const metadata: Metadata = {
  title: "Earnings Center | The Floor",
  description: "Upcoming earnings connected to accountable Floor research, calls, analysts, rooms, and watched signals.",
};

export default function Page() {
  return <TheFloorEarningsCenter />;
}
