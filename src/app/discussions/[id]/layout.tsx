import { DiscussionFocusedThreadBridge } from "@/components/discussion-focused-thread-bridge";
import { DiscussionThreadWindowDispatcher } from "@/components/discussion-thread-window-dispatcher";
import "./discussion-detail-v2.css";
import "./discussion-detail-v2-brand.css";
import "./discussion-focused-thread.css";

export default function DiscussionDetailLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <DiscussionThreadWindowDispatcher />
      <DiscussionFocusedThreadBridge />
      {children}
    </>
  );
}