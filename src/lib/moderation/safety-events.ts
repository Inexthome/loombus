import { logAuditEvent } from "@/lib/audit-log";
import type { AiSafetyReview } from "@/lib/moderation/ai-safety";

type ContentSafetyContentType = "discussion" | "reply" | "private_message" | "profile";
type ContentSafetyOutcome = "blocked" | "warned";
type ContentSafetyStage = "rule_based" | "ai_assisted";

function getContentPreview(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");

  if (normalized.length <= 220) {
    return normalized;
  }

  return `${normalized.slice(0, 217).trim()}...`;
}

export async function logRuleBasedSafetyEvent({
  userId,
  contentType,
  content,
  message,
  targetId = null,
  metadata = null,
}: {
  userId: string;
  contentType: ContentSafetyContentType;
  content: string;
  message: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await logAuditEvent({
    actor_id: userId,
    action: "content_safety.blocked",
    target_type: contentType,
    target_id: targetId,
    metadata: {
      stage: "rule_based",
      outcome: "blocked",
      category: "rule_based_safety",
      message,
      content_preview: getContentPreview(content),
      content_length: content.trim().length,
      ...(metadata ?? {}),
    },
  });
}

export async function logAiSafetyEvent({
  userId,
  contentType,
  content,
  review,
  targetId = null,
  metadata = null,
}: {
  userId: string;
  contentType: ContentSafetyContentType;
  content: string;
  review: AiSafetyReview;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const outcome: ContentSafetyOutcome =
    review.action === "block" ? "blocked" : "warned";

  await logAuditEvent({
    actor_id: userId,
    action:
      outcome === "blocked"
        ? "content_safety.blocked"
        : "content_safety.warned",
    target_type: contentType,
    target_id: targetId,
    metadata: {
      stage: "ai_assisted" satisfies ContentSafetyStage,
      outcome,
      category: review.category,
      message: review.message,
      provider: review.provider,
      model_name: review.modelName,
      content_preview: getContentPreview(content),
      content_length: content.trim().length,
      ...(metadata ?? {}),
    },
  });
}
