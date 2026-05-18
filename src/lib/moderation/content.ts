export function validateContent(content: string) {
  const text = content.trim();

  if (text.length < 8) {
    return "Content is too short.";
  }

  if (text.length > 5000) {
    return "Content is too long.";
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

  return null;
}
