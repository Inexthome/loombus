import type { Metadata } from "next";
import { AdminTrustSafetyEditorialFrame } from "../admin-trust-safety-editorial-frame";
import AdminDeletedRepliesV2Client from "./deleted-replies-v2-client";
import "./deleted-replies-v2.css";
import "../trust-safety-editorial.css";

export const metadata: Metadata = {
  title: "Deleted Replies | Loombus Admin",
  description: "Admin recovery workspace for reviewing and restoring deleted replies.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DeletedRepliesPage() {
  return (
    <AdminTrustSafetyEditorialFrame
      active="deleted-replies"
      eyebrow="Trust, safety & moderation"
      title="Deleted Replies"
      description="Review deleted replies together with their parent-discussion context, deletion record, and restoration eligibility before taking recovery action."
    >
      <AdminDeletedRepliesV2Client />
    </AdminTrustSafetyEditorialFrame>
  );
}
