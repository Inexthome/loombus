import type { Metadata } from "next";
import TheFloorPage from "@/components/the-floor-page";

export const metadata: Metadata = {
  title: "The Floor | Loombus",
  description:
    "Post accountable investing theses scored on argument quality and track record. The house never issues buy or sell ratings.",
};

export default function TheFloorRoute() {
  return <TheFloorPage />;
}
