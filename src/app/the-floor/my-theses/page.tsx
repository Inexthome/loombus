import type { Metadata } from "next";
import TheFloorMyTheses from "@/components/the-floor-my-theses";

export const metadata: Metadata = {
  title: "My Theses | The Floor",
  description: "Manage active, withdrawn, and deleted Floor research with a complete revision trail.",
};

export default function TheFloorMyThesesPage() {
  return <TheFloorMyTheses />;
}
