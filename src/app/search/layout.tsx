import type { Metadata } from "next";
import "./search-v2.css";
import "./search-v2-right-rail-fix.css";

export const metadata: Metadata = {
  title: "Search Everything",
  description:
    "Search across Loombus for discussions, people, publications, Rooms, services, requests, jobs, events, Marketplace listings, and platform destinations.",
  robots: { index: false, follow: true },
};

export default function SearchLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
