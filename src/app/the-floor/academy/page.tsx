import type { Metadata } from "next";
import TheFloorAcademy from "@/components/the-floor-academy";

export const metadata: Metadata = {
  title: "Academy and Research Standards | The Floor",
  description: "Institutional reports, analyst reputation, research challenges, and practical learning grounded in accountable Floor records.",
};

export default function TheFloorAcademyPage() {
  return <TheFloorAcademy />;
}
