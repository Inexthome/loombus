import type { Metadata } from "next";
import TheFloorNetworkCenter from "@/components/the-floor-network-center";
export const metadata: Metadata = { title: "Analysts | The Floor", description: "Browse analysts by observable Floor research coverage." };
export default function Page() { return <TheFloorNetworkCenter initialView="analysts" />; }
