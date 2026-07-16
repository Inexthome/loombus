import { DiscussionAutoLinker } from "@/components/discussion-auto-linker";
import { DiscussionFeedRefinements } from "@/components/discussion-feed-refinements";
import { DiscussionPublishToast } from "@/components/discussion-publish-toast";
import { DiscussionVideoAutoplay } from "@/components/discussion-video-autoplay";
import "./discussion-feed-media.css";
import "./discussion-feed-refinements.css";

export default function DiscussionsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="discussion-feed-route">
      <DiscussionAutoLinker />
      <DiscussionFeedRefinements />
      <DiscussionPublishToast />
      <DiscussionVideoAutoplay />
      {children}
    </div>
  );
}
