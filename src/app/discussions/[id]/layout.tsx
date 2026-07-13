import { ReplySignalGuide } from "@/components/reply-signal-guide";
import "./discussion-detail-v2.css";

export default function DiscussionDetailLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="discussion-detail-canonical">
      {children}
      <ReplySignalGuide />
    </div>
  );
}
