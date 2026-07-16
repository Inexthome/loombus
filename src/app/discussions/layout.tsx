import { DiscussionAutoLinker } from "@/components/discussion-auto-linker";
import { DiscussionPublishToast } from "@/components/discussion-publish-toast";
import { DiscussionVideoAutoplay } from "@/components/discussion-video-autoplay";
import "./discussion-feed-media.css";

export default function DiscussionsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="discussion-feed-route">
      <DiscussionAutoLinker />
      <DiscussionPublishToast />
      <DiscussionVideoAutoplay />
      {children}
    </div>
  );
}
