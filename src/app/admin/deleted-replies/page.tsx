import type { Metadata } from "next";
import AdminDeletedRepliesV2Client from "./deleted-replies-v2-client";
import "./deleted-replies-v2.css";

export const metadata: Metadata = {
  title: "Deleted Replies | Loombus Admin",
  description: "Admin recovery workspace for reviewing and restoring deleted replies.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DeletedRepliesPage() {
  return <AdminDeletedRepliesV2Client />;
}
