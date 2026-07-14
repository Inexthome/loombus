import type { Metadata } from "next";
import AdminDeletedV2Client from "./deleted-v2-client";
import "./deleted-v2.css";

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
  return <AdminDeletedV2Client />;
}
