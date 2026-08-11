export type LoombusPromptTone = "error" | "success" | "info" | "warning";

export type LoombusPromptDetail = {
  message: string;
  title?: string;
  tone?: LoombusPromptTone;
  autoDismissMs?: number;
  actionHref?: string;
  actionLabel?: string;
  compact?: boolean;
};

export function showLoombusPrompt(detail: LoombusPromptDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("loombus:prompt", { detail }));
}
