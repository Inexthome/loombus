import { DiscussionConversationIntelligenceBridge } from "@/components/discussion-conversation-intelligence-bridge";
import { DiscussionEditorialCopyCleanup } from "@/components/discussion-editorial-copy-cleanup";
import { DiscussionFollowBridge } from "@/components/discussion-follow-bridge";
import { DiscussionFocusedThreadBridge } from "@/components/discussion-focused-thread-bridge";
import { DiscussionPhaseFourNavigation } from "@/components/discussion-phase-four-navigation";
import { DiscussionReplyPaginationBridge } from "@/components/discussion-reply-pagination-bridge";
import { DiscussionThreadWindowDispatcher } from "@/components/discussion-thread-window-dispatcher";
import "./discussion-detail-v2.css";
import "./discussion-detail-v2-brand.css";
import "./discussion-focused-thread.css";
import "./discussion-phase-four.css";
import "./discussion-phase-five.css";
import "./discussion-reply-pagination.css";
import "./discussion-detail-polish.css";
import "./discussion-mobile-action-bar.css";

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
      <DiscussionPhaseFourNavigation />
      <DiscussionConversationIntelligenceBridge />
      <DiscussionEditorialCopyCleanup />
      <DiscussionFollowBridge />
      {children}
    </>
  );
}
