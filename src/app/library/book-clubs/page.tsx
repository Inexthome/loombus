import type { Metadata } from "next";
import { LibraryBookClubsDirectory } from "@/components/library/library-book-clubs-directory";
import "../library-publication-workflows-editorial.css";

export const metadata: Metadata = {
  title: "Book Clubs | Library",
  description: "Discover active, upcoming, and past Loombus Library Book Club reading sessions.",
};

export default function LibraryBookClubsPage() {
  return <LibraryBookClubsDirectory />;
}
