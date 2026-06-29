import type { ReactNode } from "react";
import DiscussionsPublicPolish from "./discussions/discussions-public-polish";

export default function V2Template({ children }: { children: ReactNode }) {
  return (
    <>
      <DiscussionsPublicPolish />
      {children}
    </>
  );
}
