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

  return null;
}
