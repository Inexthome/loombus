"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { usePathname } from "next/navigation";

export function V2CreateReviewAction() {
  const pathname = usePathname();

  if (pathname !== "/v2/create") {
    return null;
  }

  return (
    <Link
      href="/v2/create/review"
      className="fixed bottom-24 right-4 z-[120] inline-flex items-center gap-2 rounded-full border border-blue-300/40 bg-blue-500 px-4 py-3 text-sm font-bold text-white shadow-2xl shadow-blue-950/50 transition hover:bg-blue-400 sm:bottom-6 sm:right-6"
      style={{ colorScheme: "dark" }}
    >
      <Eye className="size-4" />
      Review draft
    </Link>
  );
}
