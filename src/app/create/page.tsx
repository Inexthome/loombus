import { CreateProfileCompletionNotice } from "@/components/create-profile-completion-notice";
import { CreatePublishGuard } from "@/components/create-publish-guard";
import CreateV2ClientPage from "./create-v2-client-page";

export default function CreatePage() {
  return (
    <CreatePublishGuard>
      <CreateProfileCompletionNotice />
      <CreateV2ClientPage />
    </CreatePublishGuard>
  );
}
