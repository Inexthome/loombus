import type { ReactNode } from "react";

type V2FeatureRouteShellProps = {
  children: ReactNode;
};

const v2FeatureShellStyles = `
[data-loombus-v2-feature-shell] {
  --loombus-v2-gold: #CBAB5B;
  --loombus-v2-cream: #FEFBEC;
  --loombus-page-bg: #0f0d08;
  --loombus-surface: #17130c;
  --loombus-surface-strong: #211b10;
  --loombus-surface-muted: #302713;
  --loombus-border: #5d4d28;
  --loombus-border-muted: #382f1b;
  --loombus-text: #FEFBEC;
  --loombus-text-strong: #fffdf5;
  --loombus-text-muted: #c9bea4;
  --loombus-text-subtle: #a99158;
  --loombus-primary-bg: #CBAB5B;
  --loombus-primary-text: #1c1609;
  isolation: isolate;
  background:
    radial-gradient(circle at 12% -6%, color-mix(in srgb, var(--loombus-v2-gold) 20%, transparent), transparent 30rem),
    radial-gradient(circle at 92% 8%, color-mix(in srgb, var(--loombus-v2-gold) 10%, transparent), transparent 24rem),
    var(--loombus-page-bg) !important;
}

html[data-loombus-theme="light"] [data-loombus-v2-feature-shell] {
  --loombus-page-bg: #FEFBEC;
  --loombus-surface: #fffef9;
  --loombus-surface-strong: #fbf6e5;
  --loombus-surface-muted: #f3e9c9;
  --loombus-border: #d9c581;
  --loombus-border-muted: #eadfb9;
  --loombus-text: #211c12;
  --loombus-text-strong: #171209;
  --loombus-text-muted: #665b43;
  --loombus-text-subtle: #8a7545;
  --loombus-primary-bg: #CBAB5B;
  --loombus-primary-text: #1c1609;
}

@media (prefers-color-scheme: light) {
  html[data-loombus-theme="system"] [data-loombus-v2-feature-shell] {
    --loombus-page-bg: #FEFBEC;
    --loombus-surface: #fffef9;
    --loombus-surface-strong: #fbf6e5;
    --loombus-surface-muted: #f3e9c9;
    --loombus-border: #d9c581;
    --loombus-border-muted: #eadfb9;
    --loombus-text: #211c12;
    --loombus-text-strong: #171209;
    --loombus-text-muted: #665b43;
    --loombus-text-subtle: #8a7545;
    --loombus-primary-bg: #CBAB5B;
    --loombus-primary-text: #1c1609;
  }
}

[data-loombus-v2-feature-shell] main {
  background: transparent !important;
}

[data-loombus-v2-feature-shell] main > div > section:first-of-type {
  position: relative;
  border-color: color-mix(in srgb, var(--loombus-v2-gold) 68%, var(--loombus-border)) !important;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--loombus-surface) 90%, var(--loombus-v2-cream) 10%), var(--loombus-surface)) !important;
  box-shadow: 0 24px 70px color-mix(in srgb, var(--loombus-v2-gold) 14%, transparent) !important;
}

[data-loombus-v2-feature-shell] main > div > section:first-of-type::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  border-radius: inherit;
  background: linear-gradient(180deg, #ead38d, var(--loombus-v2-gold), #9c7d32);
  pointer-events: none;
}

[data-loombus-v2-feature-shell] h1 {
  color: var(--loombus-text-strong);
}

[data-loombus-v2-feature-shell] h1::after {
  content: "";
  display: block;
  width: 4rem;
  height: 3px;
  margin-top: 1.15rem;
  border-radius: 999px;
  background: var(--loombus-v2-gold);
}

[data-loombus-v2-feature-shell] p[class*="uppercase"][class*="tracking-"],
[data-loombus-v2-feature-shell] div[class*="uppercase"][class*="tracking-"],
[data-loombus-v2-feature-shell] span[class*="uppercase"][class*="tracking-"] {
  color: var(--loombus-v2-gold) !important;
}

[data-loombus-v2-feature-shell] main section[class*="border"],
[data-loombus-v2-feature-shell] main article[class*="border"],
[data-loombus-v2-feature-shell] main a[class*="border"][class*="rounded-"] {
  border-color: color-mix(in srgb, var(--loombus-border) 78%, var(--loombus-v2-gold) 22%) !important;
}

[data-loombus-v2-feature-shell] main section:not(:first-of-type)[class*="bg-[var(--loombus-surface)]"],
[data-loombus-v2-feature-shell] main article[class*="bg-[var(--loombus-surface)]"],
[data-loombus-v2-feature-shell] main a[class*="bg-[var(--loombus-surface)]"][class*="rounded-"] {
  box-shadow: 0 12px 34px color-mix(in srgb, black 10%, transparent);
}

[data-loombus-v2-feature-shell] input,
[data-loombus-v2-feature-shell] textarea,
[data-loombus-v2-feature-shell] select {
  border-color: color-mix(in srgb, var(--loombus-border) 74%, var(--loombus-v2-gold) 26%) !important;
}

[data-loombus-v2-feature-shell] input:focus-visible,
[data-loombus-v2-feature-shell] textarea:focus-visible,
[data-loombus-v2-feature-shell] select:focus-visible,
[data-loombus-v2-feature-shell] button:focus-visible,
[data-loombus-v2-feature-shell] a:focus-visible {
  outline: none !important;
  border-color: var(--loombus-v2-gold) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--loombus-v2-gold) 32%, transparent) !important;
}

[data-loombus-v2-feature-shell] [class*="bg-[var(--loombus-primary-bg)]"],
[data-loombus-v2-feature-shell] [class*="bg-[var(--loombus-text)]"] {
  background: var(--loombus-v2-gold) !important;
  border-color: var(--loombus-v2-gold) !important;
  color: var(--loombus-primary-text) !important;
  box-shadow: 0 12px 28px color-mix(in srgb, var(--loombus-v2-gold) 24%, transparent);
}

[data-loombus-v2-feature-shell] [class*="bg-[var(--loombus-primary-bg)]"] svg,
[data-loombus-v2-feature-shell] [class*="bg-[var(--loombus-text)]"] svg {
  color: inherit !important;
}

[data-loombus-v2-feature-shell] main a[class*="rounded-full"][class*="border"],
[data-loombus-v2-feature-shell] main button[class*="rounded-full"][class*="border"] {
  background: color-mix(in srgb, var(--loombus-surface) 92%, var(--loombus-v2-gold) 8%);
}

[data-loombus-v2-feature-shell] input[type="checkbox"],
[data-loombus-v2-feature-shell] input[type="radio"] {
  accent-color: var(--loombus-v2-gold);
}

@media (hover: hover) and (pointer: fine) {
  [data-loombus-v2-feature-shell] main a[class*="rounded-"]:hover,
  [data-loombus-v2-feature-shell] main button[class*="rounded-"]:hover:not(:disabled) {
    border-color: var(--loombus-v2-gold) !important;
  }

  [data-loombus-v2-feature-shell] main a[class*="bg-[var(--loombus-surface)]"][class*="rounded-"]:hover {
    box-shadow: 0 20px 48px color-mix(in srgb, var(--loombus-v2-gold) 18%, transparent) !important;
  }
}

@media (max-width: 767px) {
  [data-loombus-v2-feature-shell] main > div > section:first-of-type::before {
    inset: 0 0 auto 0;
    width: auto;
    height: 3px;
  }

  [data-loombus-v2-feature-shell] h1::after {
    width: 3rem;
    margin-top: 0.9rem;
  }
}
`;

export default function V2FeatureRouteShell({
  children,
}: V2FeatureRouteShellProps) {
  return (
    <div
      data-loombus-v2-feature-shell
      className="min-h-screen w-full bg-[var(--loombus-page-bg)] text-[var(--loombus-text)] [&_.loombus-shell-with-right-rail]:!pr-0"
    >
      <style>{v2FeatureShellStyles}</style>
      {children}
    </div>
  );
}
