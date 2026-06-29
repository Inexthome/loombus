import type { ReactNode } from "react";
import DiscussionsPublicPolish from "./discussions-public-polish";

export default function V2DiscussionsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DiscussionsPublicPolish />
      {children}
    </>
  );
}
