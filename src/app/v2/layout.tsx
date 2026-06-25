import type { ReactNode } from "react";
import { V2ShellLinkRouter } from "./v2-shell-link-router";
import { V2CreateReviewAction } from "./create/v2-create-review-action";

export default function V2Layout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <V2ShellLinkRouter />
      <V2CreateReviewAction />
    </>
  );
}
