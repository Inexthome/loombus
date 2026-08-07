export type LoombusPromptTone = "error" | "success" | "info";

export type LoombusPromptDetail = {
  message: string;
  title?: string;
  tone?: LoombusPromptTone;
  autoDismissMs?: number;
  actionHref?: string;
  actionLabel?: string;
};

export function showLoombusPrompt(detail: LoombusPromptDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("loombus:prompt", { detail }));
}
