import { ReplySignalGuide } from "@/components/reply-signal-guide";
import DiscussionDetailShare from "./discussion-detail-share";
import "./discussion-detail-v2.css";

export default function DiscussionDetailLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="discussion-detail-route">
      {children}
      <DiscussionDetailShare />
      <ReplySignalGuide />
    </div>
  );
}
