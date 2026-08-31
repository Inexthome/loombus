import type { Metadata } from "next";
import SignalDirectoryClient from "./signal-directory-client";
import "./topics-editorial.css";

export const metadata: Metadata = {
  title: "Topics",
  description:
    "Explore the topics connecting structured discussions, publications, people, research, communities, and opportunities across Loombus.",
  alternates: { canonical: "https://loombus.com/topics" },
  openGraph: {
    title: "Topics | Loombus",
    description:
      "Explore topics connecting structured discussions, publications, people, research, communities, and opportunities.",
    url: "https://loombus.com/topics",
  },
  twitter: {
    title: "Topics | Loombus",
    description:
      "Explore topics connecting ideas, knowledge, people, communities, and opportunities.",
  },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TopicsPage() {
  return <SignalDirectoryClient />;
}
