"use client";

import CreateDiscussionComposer from "@/components/create-discussion-composer";
import { CreateAttachmentTriggerBridge } from "@/components/create-attachment-trigger-bridge";

export default function CreateV2ClientPage() {
  return (
    <>
      <CreateDiscussionComposer />
      <CreateAttachmentTriggerBridge />
    </>
  );
}
