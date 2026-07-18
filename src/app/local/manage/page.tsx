import type { Metadata } from "next";
import LocalManagePage from "@/components/local-manage-page";

export const metadata: Metadata = {
  title: "Manage Local Locations",
  description:
    "Manage privacy-safe Local Discovery areas for your attributable Loombus listings.",
  robots: { index: false, follow: false },
};

export default function ManageLocalPage() {
  return <LocalManagePage />;
}
