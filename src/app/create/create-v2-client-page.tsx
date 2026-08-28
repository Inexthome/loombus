"use client";

import CreateDiscussionComposer from "@/components/create-discussion-composer";
import { CreateAttachmentTriggerBridge } from "@/components/create-attachment-trigger-bridge";
import { CreateInfoTooltips } from "@/components/create-info-tooltips";

export default function CreateV2ClientPage() {
  return (
    <>
      <CreateDiscussionComposer />
      <CreateAttachmentTriggerBridge />
      <CreateInfoTooltips />
    </>
  );
}
