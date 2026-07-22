import { CreateDiscussionAudiencePolicyGuard } from "@/components/create-discussion-audience-policy-guard";
import { CreateDiscussionRefinements } from "@/components/create-discussion-refinements";
import { CreateMobileComposerAdapter } from "@/components/create-mobile-composer-adapter";
import { CreatePublishGuard } from "@/components/create-publish-guard";
import CreateV2ClientPage from "./create-v2-client-page";

export default function CreatePage() {
  return (
    <CreatePublishGuard>
      <CreateDiscussionRefinements />
      <CreateDiscussionAudiencePolicyGuard />
      <CreateV2ClientPage />
      <CreateMobileComposerAdapter />
      <style>{`
        @media (max-width: 767px) {
          main[data-mobile-create] .mc-context-wrap[data-mc-ui="true"] {
            display: block !important;
          }
        }
      `}</style>
    </CreatePublishGuard>
  );
}
