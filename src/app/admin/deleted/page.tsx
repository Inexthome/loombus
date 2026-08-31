import type { Metadata } from "next";
import { AdminTrustSafetyEditorialFrame } from "../admin-trust-safety-editorial-frame";
import AdminDeletedV2Client from "./deleted-v2-client";
import "./deleted-v2.css";
import "../trust-safety-editorial.css";

export const metadata: Metadata = {
  title: "Deleted Discussions | Loombus Admin",
  description:
    "Admin recovery workspace for reviewing and restoring soft-deleted Loombus discussions.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DeletedContentPage() {
  return (
    <AdminTrustSafetyEditorialFrame
      active="deleted"
      eyebrow="Trust, safety & moderation"
      title="Deleted Discussions"
      description="Inspect soft-deleted discussions, understand why they were removed, and restore eligible records without separating recovery from its moderation context."
    >
      <AdminDeletedV2Client />
    </AdminTrustSafetyEditorialFrame>
  );
}
