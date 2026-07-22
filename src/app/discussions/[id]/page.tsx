import { DiscussionAudienceDetailBadge } from "@/components/discussion-audience-detail-badge";
import DiscussionDetailActionsLayer from "./discussion-detail-actions-layer";
import DiscussionDetailV2Client from "./discussion-detail-v2-client";

export default function DiscussionPage() {
  return (
    <>
      <DiscussionDetailV2Client />
      <DiscussionAudienceDetailBadge />
      <DiscussionDetailActionsLayer />
    </>
  );
}
