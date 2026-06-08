import { validateContent } from "@/lib/moderation/content";
import {
  getAiSafetyErrorPayload,
  reviewContentSafety,
  type AiSafetyReview,
} from "@/lib/moderation/ai-safety";
import {
  logAiSafetyEvent,
  logRuleBasedSafetyEvent,
} from "@/lib/moderation/safety-events";

export type LoombusSafetyMode =
  | "public_content"
  | "public_reply"
  | "private_message"
  | "profile_text";

export type LoombusSafetyDecision = {
  allowed: boolean;
  action: "allow" | "warn" | "block";
  code?: string;
  message?: string;
  category?: string;
  provider?: string;
  aiReview?: AiSafetyReview;
};

function normalizeSafetyText(text: string) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getPrivateMessageAbuseError(text: string) {
  const normalized = normalizeSafetyText(text);

  const directInsultWords =
    "(?:ugly|stupid|dumb|idiot|idiotic|moron|worthless|shameful|ashamed|pathetic|disgusting|gross|trash|garbage|loser|fool|clown|nasty|weak|weirdo|creep|evil|horrible)";

  const severeDirectProfanityWords =
    "(?:motherfucker|mfer|mf|fucker|fuckface|fuckhead|shithead|asshole|arsehole|bitch|bastard|cunt|dickhead|prick|piece of shit|piece-of-shit)";

  const standaloneProfanityWords =
    "(?:fuck|fucking|fucked|fucker|shit|bullshit|motherfucker|mfer|mf|asshole|bitch|bastard|cunt|dickhead|prick)";

  const directAbusePatterns = [
    new RegExp(
      `\\b(?:you are|you're|youre|u are|ur|you r)\\s+(?:so\\s+|such\\s+)?(?:a\\s+|an\\s+)?(?:${directInsultWords}|${severeDirectProfanityWords})\\b`,
      "i"
    ),
    new RegExp(
      `\\b(?:you look|you sound|u look|u sound)\\s+(?:so\\s+)?(?:${directInsultWords}|${severeDirectProfanityWords})\\b`,
      "i"
    ),
    new RegExp(
      `\\b(?:you|u)\\s+(?:are\\s+)?(?:a\\s+|an\\s+)?(?:${directInsultWords}|${severeDirectProfanityWords})\\b`,
      "i"
    ),
    new RegExp(`\\b(?:${severeDirectProfanityWords})\\b`, "i"),
    new RegExp(`\\b(?:${standaloneProfanityWords})\\b`, "i"),
    /\b(?:nobody likes you|everyone hates you|shame on you|shut up)\b/i,
  ];

  if (directAbusePatterns.some((pattern) => pattern.test(normalized))) {
    return "Private messages cannot include profanity, direct name-calling, shaming, or personal insults. Please rewrite it respectfully.";
  }

  return null;
}

function getRuleBasedSafetyError(
  text: string,
  mode: LoombusSafetyMode,
  maxLength?: number
) {
  if (mode === "private_message") {
    const privateMessageError = getPrivateMessageAbuseError(text);

    if (privateMessageError) {
      return {
        message: privateMessageError,
        code: "message_abusive_language_blocked",
      };
    }
  }

  const moderationError = validateContent(
    text,
    typeof maxLength === "number" ? { maxLength } : {}
  );

  if (moderationError) {
    return {
      message: moderationError,
      code:
        mode === "private_message"
          ? "message_safety_blocked"
          : "content_safety_blocked",
    };
  }

  return null;
}

function getSafetyContentType(mode: LoombusSafetyMode) {
  if (mode === "public_content") {
    return "discussion";
  }

  if (mode === "private_message") {
    return "private_message";
  }

  if (mode === "profile_text") {
    return "profile";
  }

  return "reply";
}

function getAiSafetyContentType(mode: LoombusSafetyMode) {
  return mode === "public_content" ? "discussion" : "reply";
}

export async function reviewLoombusSafety({
  userId,
  content,
  mode,
  targetId = null,
  maxLength,
  metadata = null,
}: {
  userId: string;
  content: string;
  mode: LoombusSafetyMode;
  targetId?: string | null;
  maxLength?: number;
  metadata?: Record<string, unknown> | null;
}): Promise<LoombusSafetyDecision> {
  const cleanContent = content.trim();

  if (!cleanContent) {
    return {
      allowed: true,
      action: "allow",
    };
  }

  const ruleBasedError = getRuleBasedSafetyError(
    cleanContent,
    mode,
    maxLength
  );

  if (ruleBasedError) {
    await logRuleBasedSafetyEvent({
      userId,
      contentType: getSafetyContentType(mode),
      content: cleanContent,
      message: ruleBasedError.message,
      targetId,
      metadata,
    });

    return {
      allowed: false,
      action: "block",
      code: ruleBasedError.code,
      message: ruleBasedError.message,
      category: "rule_based_safety",
      provider: "none",
    };
  }

  const aiSafetyReview = await reviewContentSafety({
    content: cleanContent,
    contentType: getAiSafetyContentType(mode),
  });

  if (aiSafetyReview.action === "block") {
    await logAiSafetyEvent({
      userId,
      contentType: getSafetyContentType(mode),
      content: cleanContent,
      targetId,
      review: aiSafetyReview,
      metadata,
    });

    const payload = getAiSafetyErrorPayload(aiSafetyReview);

    return {
      allowed: false,
      action: "block",
      code:
        mode === "private_message"
          ? "message_safety_blocked"
          : payload.code,
      message: payload.error,
      category: payload.category,
      provider: payload.provider,
      aiReview: aiSafetyReview,
    };
  }

  if (aiSafetyReview.action === "warn") {
    await logAiSafetyEvent({
      userId,
      contentType: getSafetyContentType(mode),
      content: cleanContent,
      targetId,
      review: aiSafetyReview,
      metadata,
    });

    return {
      allowed: true,
      action: "warn",
      code: "content_safety_warning",
      message: aiSafetyReview.message,
      category: aiSafetyReview.category,
      provider: aiSafetyReview.provider,
      aiReview: aiSafetyReview,
    };
  }

  return {
    allowed: true,
    action: "allow",
    category: aiSafetyReview.category,
    provider: aiSafetyReview.provider,
    aiReview: aiSafetyReview,
  };
}
