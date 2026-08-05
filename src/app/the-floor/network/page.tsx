import type { Metadata } from "next";
import TheFloorNetworkCenter from "@/components/the-floor-network-center";
export const metadata: Metadata = { title: "Network Center | The Floor", description: "Company and analyst directories, watched-research alerts, live sessions, and replay knowledge." };
export default function Page() { return <TheFloorNetworkCenter />; }
