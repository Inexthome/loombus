import Link from "next/link";
import { LibraryFunctionalSurface } from "@/components/library/library-functional-surface";

export default function LibraryPage() {
  return (
    <>
      <nav
        className="mx-auto flex w-full max-w-6xl justify-end px-4 pt-4 sm:px-6 lg:px-8"
        aria-label="Library publishing shortcut"
      >
        <Link
          href="/library/publish"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#CBAB5B] px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CBAB5B] focus-visible:ring-offset-2"
        >
          Author Publishing
        </Link>
      </nav>
      <LibraryFunctionalSurface />
    </>
  );
}
