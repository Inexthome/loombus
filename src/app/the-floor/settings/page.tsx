import type { Metadata } from "next";
import TheFloorSettings from "@/components/the-floor-settings";

export const metadata: Metadata = {
  title: "The Floor Settings | Loombus",
  description: "Manage The Floor membership and billing.",
};

export default function FloorSettingsPage() {
  return <TheFloorSettings />;
}
