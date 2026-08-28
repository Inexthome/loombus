import { CreateProfileCompletionNotice } from "@/components/create-profile-completion-notice";
import { CreatePublishGuard } from "@/components/create-publish-guard";
import { CreatePublishMessagePrompt } from "@/components/create-publish-message-prompt";
import CreateV2ClientPage from "./create-v2-client-page";
import "./create-flat.css";
import "./create-detail-refinement.css";
import "./create-selector-polish.css";

export default function CreatePage() {
  return (
    <CreatePublishGuard>
      <CreatePublishMessagePrompt />
      <CreateProfileCompletionNotice />
      <CreateV2ClientPage />
    </CreatePublishGuard>
  );
}
