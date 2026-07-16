import { CreateDiscussionRefinements } from "@/components/create-discussion-refinements";
import { CreatePublishGuard } from "@/components/create-publish-guard";
import CreateV2ClientPage from "./create-v2-client-page";

export default function CreatePage() {
  return (
    <CreatePublishGuard>
      <CreateDiscussionRefinements />
      <CreateV2ClientPage />
    </CreatePublishGuard>
  );
}
