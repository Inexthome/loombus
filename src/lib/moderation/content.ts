type ModerationPattern = {
  pattern: RegExp;
  message: string;
};

function hasPattern(text: string, patterns: ModerationPattern[]) {
  return patterns.find(({ pattern }) => pattern.test(text))?.message ?? null;
}

const severeSafetyPatterns: ModerationPattern[] = [
  {
    pattern: /\b(kill|hurt|beat|attack|shoot|stab)\s+(you|him|her|them|yourself)\b/i,
    message:
      "This content appears to include a threat or encouragement of harm. Please revise before posting.",
  },
  {
    pattern: /\b(kill yourself|hurt yourself|end your life)\b/i,
    message:
      "This content appears to encourage self-harm. Please revise before posting.",
  },
  {
    pattern: /\b(doxx|dox|post your address|drop your address|leak your address|leak your phone|share your private information)\b/i,
    message:
      "This content appears to include doxxing or private-information abuse. Please revise before posting.",
  },
  {
    pattern: /\b(child sexual|sexual exploitation|sexual abuse material|revenge porn|non[-\s]?consensual intimate)\b/i,
    message:
      "This content appears to involve sexual abuse or exploitation. It cannot be posted.",
  },
];

const targetedHarassmentPatterns: ModerationPattern[] = [
  {
    pattern: /\b(you are|you're|ur)\s+(stupid|trash|worthless|disgusting|pathetic|garbage|a loser|an idiot)\b/i,
    message:
      "This content appears to target another person with degrading language. Please critique ideas instead of attacking people.",
  },
  {
    pattern: /\b(shut up|go away|nobody wants you|everyone hates you)\b/i,
    message:
      "This content appears hostile toward another member. Please revise it into a constructive reply.",
  },
  {
    pattern: /\b(i will follow you|i'm following you|i know where you live|i know where you work|i am watching you)\b/i,
    message:
      "This content appears to include stalking or intimidation language. Please revise before posting.",
  },
];

const profanityAttackPatterns: ModerationPattern[] = [
  {
    pattern: /\b(fuck you|f\*+k you|fck you)\b/i,
    message:
      "This content appears to use profanity as a direct personal attack. Please revise before posting.",
  },
  {
    pattern: /\b(bitch|asshole|dumbass|piece of shit)\b/i,
    message:
      "This content appears to include abusive profanity. Please revise before posting.",
  },
];

const rageBaitPatterns: ModerationPattern[] = [
  {
    pattern: /\b(only idiots believe|anyone who disagrees is|everyone who thinks.*is stupid|this proves.*people are stupid)\b/i,
    message:
      "This content appears framed as rage bait or broad shaming. Please make the claim more specific and constructive.",
  },
];

export function validateContent(
  content: string,
  options: { maxLength?: number } = {}
) {
  const text = content.trim();
  const maxLength = options.maxLength ?? 5000;

  if (text.length < 8) {
    return "Content is too short.";
  }

  if (text.length > maxLength) {
    return `Content is too long. Maximum length is ${maxLength.toLocaleString()} characters.`;
  }

  const repeatedPattern = /(.)\1{14,}/;

  if (repeatedPattern.test(text)) {
    return "Content contains spam-like repetition.";
  }

  const excessiveCaps =
    text.length > 20 &&
    text.replace(/[^A-Z]/g, "").length / text.length > 0.7;

  if (excessiveCaps) {
    return "Please avoid excessive capital letters.";
  }

  const severeSafetyMessage = hasPattern(text, severeSafetyPatterns);

  if (severeSafetyMessage) {
    return severeSafetyMessage;
  }

  const harassmentMessage = hasPattern(text, targetedHarassmentPatterns);

  if (harassmentMessage) {
    return harassmentMessage;
  }

  const profanityMessage = hasPattern(text, profanityAttackPatterns);

  if (profanityMessage) {
    return profanityMessage;
  }

  const rageBaitMessage = hasPattern(text, rageBaitPatterns);

  if (rageBaitMessage) {
    return rageBaitMessage;
  }

  return null;
}
