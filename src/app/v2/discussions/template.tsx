import type { ReactNode } from "react";
import { PublicDiscussionsPreview } from "./public-discussions-preview";
import { DiscussionDetailRuntimePolish } from "./discussion-detail-runtime-polish";

export default function V2DiscussionsTemplate({ children }: { children: ReactNode }) {
  return (
    <PublicDiscussionsPreview>
      <DiscussionDetailRuntimePolish>{children}</DiscussionDetailRuntimePolish>
    </PublicDiscussionsPreview>
  );
}
