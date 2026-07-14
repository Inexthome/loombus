import type { Metadata } from "next";
import TopicMemoryV2Client from "./topic-memory-v2-client";
import "./topic-memory-v2.css";

export const metadata: Metadata = {
  title: "Topic Memory Operations | Loombus Admin",
  description:
    "Admin-only operational visibility into recurring Loombus topics, Reality Lenses, tags, engagement signals, and cached AI idea coverage.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminTopicMemoryPage() {
  return <TopicMemoryV2Client />;
}
