const originalFetch = globalThis.fetch;
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalConsoleError = console.error;

try {
  // Use a non-empty synthetic key so the safety module reaches the provider
  // call. The fetch stub below guarantees there is no external network request.
  process.env.OPENAI_API_KEY = "issue-669-controlled-failure-test";
  globalThis.fetch = async () => {
    throw new Error("simulated OpenAI unavailability");
  };

  // Keep expected simulated-provider diagnostics out of CI noise.
  console.error = () => {};

  const { reviewContentSafety } = await import(
    `../../src/lib/moderation/ai-safety.ts?fail-closed-test=${Date.now()}`
  );

  const result = await reviewContentSafety({
    content: "Controlled benign private-message safety test.",
    contentType: "private_message",
  });

  const expected = {
    action: "block",
    category: "ai_safety_unavailable",
    provider: "none",
    unavailable: true,
  };

  for (const [field, value] of Object.entries(expected)) {
    if (result[field] !== value) {
      throw new Error(
        `AI safety fail-closed verification failed: expected ${field}=${JSON.stringify(value)}, received ${JSON.stringify(result[field])}`
      );
    }
  }

  if (typeof result.message !== "string" || !result.message.trim()) {
    throw new Error("AI safety fail-closed verification failed: missing retry message");
  }

  console.log(
    "AI safety fail-closed verification passed: simulated OpenAI failure returned block/ai_safety_unavailable with no alternate provider."
  );
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;

  if (originalOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
}
