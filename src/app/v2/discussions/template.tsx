import type { ReactNode } from "react";
import { PublicDiscussionsPreview } from "./public-discussions-preview";

export default function V2DiscussionsTemplate({ children }: { children: ReactNode }) {
  return <PublicDiscussionsPreview>{children}</PublicDiscussionsPreview>;
}
