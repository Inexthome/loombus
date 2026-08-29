"use client";

import CreateDiscussionComposer from "@/components/create-discussion-composer";
import { CreateAttachmentTriggerBridge } from "@/components/create-attachment-trigger-bridge";
import { CreateInfoTooltips } from "@/components/create-info-tooltips";
import { CreateInteractionHardening } from "@/components/create-interaction-hardening";

export default function CreateV2ClientPage() {
  return (
    <>
      <CreateDiscussionComposer />
      <CreateAttachmentTriggerBridge />
      <CreateInfoTooltips />
      <CreateInteractionHardening />
    </>
  );
}