import type { Metadata } from "next";
import { LibraryCommerceCenter } from "@/components/library/library-commerce-center";

export const metadata: Metadata = {
  title: "Library Purchases & Sales | Loombus",
  description: "View your Loombus Library purchases, author sales, earnings, and payout status.",
  robots: { index: false, follow: false },
};

export default function LibraryCommercePage() {
  return <LibraryCommerceCenter />;
}
