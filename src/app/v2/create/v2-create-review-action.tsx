"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { usePathname } from "next/navigation";

export function V2CreateReviewAction() {
  const pathname = usePathname() ?? "";
  const normalizedPathname = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const shouldShow = normalizedPathname === "/v2/create";

  if (!shouldShow) {
    return null;
  }

  return (
    <Link
      href="/v2/create/review"
      aria-label="Review draft"
      className="fixed bottom-24 right-4 z-[9999] inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-2xl shadow-blue-950/60 ring-2 ring-blue-200/20 transition hover:bg-blue-400 sm:bottom-6 sm:right-6"
      style={{ colorScheme: "dark" }}
    >
      <Eye className="size-4" />
      Review draft
    </Link>
  );
}
