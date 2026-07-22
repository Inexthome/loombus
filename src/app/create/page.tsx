import { CreateDiscussionAudienceBridge } from "@/components/create-discussion-audience-bridge";
import { CreateDiscussionAudiencePublicFallbackGuard } from "@/components/create-discussion-audience-public-fallback-guard";
import { CreateDiscussionRefinements } from "@/components/create-discussion-refinements";
import { CreatePublishGuard } from "@/components/create-publish-guard";
import CreateV2ClientPage from "./create-v2-client-page";

export default function CreatePage() {
  return (
    <CreatePublishGuard>
      <CreateDiscussionRefinements />
      <CreateDiscussionAudiencePublicFallbackGuard />
      <CreateDiscussionAudienceBridge />
      <CreateV2ClientPage />
    </CreatePublishGuard>
  );
}
