import { DiscussionFocusedThreadBridge } from "@/components/discussion-focused-thread-bridge";
import { DiscussionReplyPaginationBridge } from "@/components/discussion-reply-pagination-bridge";
import { DiscussionThreadWindowDispatcher } from "@/components/discussion-thread-window-dispatcher";
import "./discussion-detail-v2.css";
import "./discussion-detail-v2-brand.css";
import "./discussion-focused-thread.css";
import "./discussion-reply-pagination.css";

export default function DiscussionDetailLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <DiscussionThreadWindowDispatcher />
      <DiscussionFocusedThreadBridge />
      <DiscussionReplyPaginationBridge />
      {children}
    </>
  );
}