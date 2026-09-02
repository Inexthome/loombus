import Link from "next/link";
import type { ReactNode } from "react";
import "./library-publish-editorial.css";
import "./library-publish-proofing.css";

export default function LibraryPublishLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav aria-label="Library publishing workspace" className="library-publish-workspace-nav">
        <div className="library-publish-workspace-nav-inner">
          <Link href="/library/publish">New & first publication</Link>
          <Link href="/library/publish/revisions">Published revisions</Link>
        </div>
      </nav>
      {children}
    </>
  );
}
