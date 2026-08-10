import type { Metadata } from "next";
import PolicyContentPreviewClient from "./policy-content-preview-client";

export const metadata: Metadata = {
  title: "Policy Content Preview | Loombus Admin",
  description:
    "Restricted read-only preview of a registered Loombus structured policy-content candidate.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function PolicyContentPreviewPage() {
  return <PolicyContentPreviewClient />;
}
