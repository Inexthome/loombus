import type { Metadata } from "next";
import TheFloorNetworkCenter from "@/components/the-floor-network-center";
export const metadata: Metadata = { title: "Companies | The Floor", description: "Browse companies with observable research coverage on The Floor." };
export default function Page() { return <TheFloorNetworkCenter initialView="companies" />; }
