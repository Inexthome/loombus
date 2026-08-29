import { DiscussionAudienceDetailBadge } from "@/components/discussion-audience-detail-badge";
import { DiscussionViewersPanel } from "@/components/discussion-viewers-panel";
import { DiscussionLibraryFeedbackLauncher } from "@/components/library/discussion-library-feedback-launcher";
import "./discussion-mobile-back-navigation.css";
import DiscussionDetailActionsLayer from "./discussion-detail-actions-layer";
import DiscussionDetailV2Client from "./discussion-detail-v2-client";
import DiscussionDetailWorkspace from "./discussion-detail-workspace";
import DiscussionInlinePointReplies from "./discussion-inline-point-replies";
import DiscussionMobileBackNavigation from "./discussion-mobile-back-navigation";

export default function DiscussionPage() {
  return (
    <>
      <DiscussionMobileBackNavigation />
      <DiscussionDetailV2Client />
      <DiscussionDetailWorkspace />
      <DiscussionInlinePointReplies />
      <DiscussionViewersPanel />
      <DiscussionAudienceDetailBadge />
      <DiscussionDetailActionsLayer />
      <DiscussionLibraryFeedbackLauncher />
    </>
  );
}
