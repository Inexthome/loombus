import { CreateDiscussionAudiencePolicyGuard } from "@/components/create-discussion-audience-policy-guard";
import { CreateDiscussionRefinements } from "@/components/create-discussion-refinements";
import { CreateMobileComposerAdapter } from "@/components/create-mobile-composer-adapter";
import { CreateMobileComposerCorrections } from "@/components/create-mobile-composer-corrections";
import { CreatePublishGuard } from "@/components/create-publish-guard";
import CreateV2ClientPage from "./create-v2-client-page";

export default function CreatePage() {
  return (
    <CreatePublishGuard>
      <CreateDiscussionRefinements />
      <CreateDiscussionAudiencePolicyGuard />
      <CreateV2ClientPage />
      <CreateMobileComposerAdapter />
      <CreateMobileComposerCorrections />
    </CreatePublishGuard>
  );
}
