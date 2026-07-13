import { ReplySignalGuide } from "@/components/reply-signal-guide";
import DiscussionDetailV2Shell from "./discussion-detail-v2-shell";
import "./discussion-detail-v2.css";

export default function DiscussionDetailLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DiscussionDetailV2Shell>
      {children}
      <ReplySignalGuide />
    </DiscussionDetailV2Shell>
  );
}
