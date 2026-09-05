import type { Metadata } from "next";
import { DiscussionAutoLinker } from "@/components/discussion-auto-linker";
import { DiscussionEngagementModeControl } from "@/components/discussion-engagement-mode-control";
import { DiscussionFeedRefinements } from "@/components/discussion-feed-refinements";
import { DiscussionFollowUpdatesBridge } from "@/components/discussion-follow-updates-bridge";
import { DiscussionPublishToast } from "@/components/discussion-publish-toast";
import { DiscussionViewModeControl } from "@/components/discussion-view-mode-control";
import { DiscussionsCreateComposerBridge } from "@/components/discussions-create-composer-bridge";
import { DiscussionsEngagementBridge } from "@/components/discussions-engagement-bridge";
import { DiscussionsEngagementLayoutBridge } from "@/components/discussions-engagement-layout-bridge";
import { DiscussionsLaunchPricingBridge } from "@/components/discussions-launch-pricing-bridge";
import { DiscussionVideoAutoplay } from "@/components/discussion-video-autoplay";
import { QuestionOfTheWeekBridge } from "@/components/question-of-the-week-bridge";
import "../create/create-flat.css";
import "../create/create-detail-refinement.css";
import "../create/create-selector-polish.css";
import "../create/create-selection-surfaces.css";
import "./discussion-feed-media.css";
import "./discussion-feed-refinements.css";
import "./discussion-index-polish.css";
import "./discussion-view-modes.css";
import "./discussions-create-modal.css";
import "./discussion-top-controls.css";
import "./discussion-engagement-mode-control.css";
import "./discussion-weave-feed.css";
import "./discussion-weave-page-surface.css";
import "./discussion-weave-density.css";
import "./discussion-view-relocation.css";
import "./discussion-compact-weave.css";
import "./discussion-compact-media-square.css";
import "./discussion-qotw-card-weave-restoration.css";
import "./discussion-desktop-control-labels.css";
import "./discussions-performance.css";

export const metadata: Metadata = {
  title: "Structured Discussions",
  description: "Explore ideas through open discussions, debates, research questions, and problem solving with clearer context, evidence, and useful replies.",
  openGraph: {
    title: "Structured Discussions | Loombus",
    description: "Explore ideas through open discussions, debates, research questions, and problem solving with clearer context, evidence, and useful replies.",
    url: "https://loombus.com/discussions",
  },
  twitter: {
    title: "Structured Discussions | Loombus",
    description: "Explore ideas through structured discussion, evidence, and useful replies.",
  },
};

export default function DiscussionsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="discussion-feed-route">
      <DiscussionAutoLinker />
      <DiscussionFeedRefinements />
      <DiscussionPublishToast />
      <DiscussionVideoAutoplay />
      <DiscussionsCreateComposerBridge />
      <DiscussionsLaunchPricingBridge />
      <DiscussionViewModeControl />
      <DiscussionEngagementModeControl />
      <QuestionOfTheWeekBridge />
      <DiscussionsEngagementBridge />
      <DiscussionsEngagementLayoutBridge />
      <DiscussionFollowUpdatesBridge />
      {children}
    </div>
  );
}
