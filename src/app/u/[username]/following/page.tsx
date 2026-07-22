import type { Metadata } from "next";
import MemberConnectionsV2 from "@/components/member-connections-v2";

export const metadata: Metadata = {
  title: "Following | Loombus",
  description:
    "Review the visible members followed by a Loombus member.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function FollowingPage() {
  return <MemberConnectionsV2 mode="following" />;
}
