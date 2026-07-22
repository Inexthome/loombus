import type { Metadata } from "next";
import MemberConnectionsV2 from "@/components/member-connections-v2";

export const metadata: Metadata = {
  title: "Followers | Loombus",
  description:
    "Review the visible followers connected to a Loombus member.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function FollowersPage() {
  return <MemberConnectionsV2 mode="followers" />;
}
