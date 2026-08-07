import { CreateProfileCompletionNotice } from "@/components/create-profile-completion-notice";
import { CreatePublishGuard } from "@/components/create-publish-guard";
import { CreatePublishMessagePrompt } from "@/components/create-publish-message-prompt";
import CreateV2ClientPage from "./create-v2-client-page";

export default function CreatePage() {
  return (
    <CreatePublishGuard>
      <CreatePublishMessagePrompt />
      <CreateProfileCompletionNotice />
      <CreateV2ClientPage />
    </CreatePublishGuard>
  );
}
