import { DiscussionFocusedThreadBridge } from "@/components/discussion-focused-thread-bridge";
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
      <DiscussionFocusedThreadBridge />
      {children}
    </>
  );
}
