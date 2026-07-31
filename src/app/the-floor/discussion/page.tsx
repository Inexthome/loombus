import type { Metadata } from "next";
import TheFloorDiscussionPage from "@/components/the-floor-discussion-page";

export const metadata: Metadata = {
  title: "The Floor Discussion | Loombus",
  description:
    "Where Floor members talk through reasoning -- thesis cards and the weekly synthesis sit on top of this feed.",
};

export default function TheFloorDiscussionRoute() {
  return <TheFloorDiscussionPage />;
}
