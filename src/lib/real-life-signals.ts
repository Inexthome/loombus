export const REAL_LIFE_SIGNALS_TOPIC = "Real Life Signals" as const;

export const REAL_LIFE_SIGNALS_PROMPTS = [
  {
    title: "What nobody tells you about...",
    description: "Share a real lesson, pressure, or tradeoff people usually leave out.",
    example: "What nobody tells you about rebuilding your life after a major setback.",
  },
  {
    title: "The hidden cost of...",
    description: "Name the invisible pressure behind success, work, money, family, or identity.",
    example: "The hidden cost of always being the strong person.",
  },
  {
    title: "I learned this too late...",
    description: "Turn lived experience into a lesson someone else can think through.",
    example: "I learned too late that ambition without direction can become exhaustion.",
  },
  {
    title: "The part people don't see...",
    description: "Explain the real side behind a public outcome or polished identity.",
    example: "The part people don't see about being a founder.",
  },
  {
    title: "How I rebuilt after...",
    description: "Share a grounded rebuilding story without turning it into professional advice.",
    example: "How I rebuilt my confidence after a career failure.",
  },
] as const;

export const REAL_LIFE_SIGNALS_BOUNDARY =
  "Real Life Signals is for lived experience, perspective, and thoughtful discussion. It is not therapy, crisis support, legal advice, medical advice, or financial advice. Share experience, not instructions.";

export type RealLifeSignalsSeverity = "green" | "yellow" | "red" | "crisis";

export type RealLifeSignalsSafetyResult = {
  allowed: boolean;
  severity: RealLifeSignalsSeverity;
  code: string;
  message: string;
  matchedRule?: string;
};

const CRISIS_PATTERNS: Array<[RegExp, string]> = [
  [/\b(i\s*(am|'m|’m)?\s*)?(going to|gonna|about to|planning to)\s+(kill myself|end my life|hurt myself|harm myself)\b/i, "immediate_self_harm_intent"],
  [/\b(i\s*(want|wanna)\s+to\s+(die|kill myself|end my life))\b/i, "self_harm_intent"],
  [/\b(i\s*(have|made)\s+a\s+plan\s+to\s+(kill myself|end my life|hurt myself|harm myself))\b/i, "self_harm_plan"],
  [/\b(i\s*(took|swallowed)\s+.*\b(pills|poison|overdose))\b/i, "possible_overdose"],
  [/\b(i\s*(am|'m|’m)?\s*)?(going to|gonna|about to|planning to)\s+(kill|hurt|harm)\s+(someone|somebody|them|him|her)\b/i, "immediate_violence_intent"],
];

const BLOCK_PATTERNS: Array<[RegExp, string]> = [
  [/\b(how to|steps to|best way to|instructions? to)\s+(kill yourself|end your life|hurt yourself|harm yourself|self[-\s]?harm)\b/i, "self_harm_instruction_request_or_advice"],
  [/\b(you should|you need to|just)\s+(kill yourself|end your life|hurt yourself|harm yourself)\b/i, "encouraging_self_harm"],
  [/\b(stop|quit|discontinue)\s+(your\s+)?(medication|medicine|antidepressants?|therapy|treatment)\b/i, "dangerous_medical_directive"],
  [/\b(ignore|do not listen to|don't listen to)\s+(your\s+)?(doctor|therapist|psychiatrist|lawyer|attorney|financial advisor)\b/i, "dangerous_professional_directive"],
  [/\b(guaranteed|100%|risk[-\s]?free)\s+(profit|return|investment|money|income)\b/i, "financial_guarantee"],
  [/\b(invest|put|move)\s+(all|everything|your life savings)\s+.*\b(stock|crypto|option|investment|coin|forex)\b/i, "reckless_financial_directive"],
  [/\b(here is|here's)\s+(their|his|her)\s+(address|phone number|private information|ssn|social security)\b/i, "doxxing_or_private_information"],
  [/\b(you are worthless|nobody wants you|everyone would be better without you)\b/i, "degrading_harassment"],
];

const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(lonely|loneliness|burned out|burnout|exhausted|depressed|anxious|panic|grief|regret|failure|divorce|financial stress|money stress|lost my job)\b/i, "sensitive_lived_experience"],
];

function normalizeInput(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

export function isRealLifeSignalsTopic(topic: string | null | undefined) {
  return String(topic ?? "").trim().toLowerCase() === REAL_LIFE_SIGNALS_TOPIC.toLowerCase();
}

export function checkRealLifeSignalsSafety({
  topic,
  title,
  body,
}: {
  topic: string | null | undefined;
  title?: string | null;
  body?: string | null;
}): RealLifeSignalsSafetyResult {
  if (!isRealLifeSignalsTopic(topic)) {
    return {
      allowed: true,
      severity: "green",
      code: "not_real_life_signals",
      message: "Not a Real Life Signals submission.",
    };
  }

  const combined = normalizeInput(`${title ?? ""}\n${body ?? ""}`);

  for (const [pattern, rule] of CRISIS_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        allowed: false,
        severity: "crisis",
        code: "real_life_signals_crisis",
        matchedRule: rule,
        message:
          "This sounds urgent or crisis-related, so it cannot be published as a normal discussion. If you or someone else may be in immediate danger, contact local emergency services now. In the U.S. and Canada, call or text 988 for crisis support.",
      };
    }
  }

  for (const [pattern, rule] of BLOCK_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        allowed: false,
        severity: "red",
        code: "real_life_signals_blocked",
        matchedRule: rule,
        message:
          "Real Life Signals is for lived experience, not harmful instructions, crisis advice, harassment, or professional directives. Please rewrite this as personal experience or perspective without telling others what to do.",
      };
    }
  }

  for (const [pattern, rule] of SENSITIVE_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        allowed: true,
        severity: "yellow",
        code: "real_life_signals_sensitive",
        matchedRule: rule,
        message:
          "Sensitive Real Life Signals content detected. Keep the post focused on lived experience and avoid giving medical, legal, financial, or crisis advice.",
      };
    }
  }

  return {
    allowed: true,
    severity: "green",
    code: "real_life_signals_clear",
    message: "Real Life Signals content passed safety checks.",
  };
}
