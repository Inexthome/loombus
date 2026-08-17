import fs from "node:fs";

const panelPath = "src/components/library/library-ask-loombus-panel.tsx";
if (!fs.existsSync(panelPath)) throw new Error(`Missing Ask Loombus panel: ${panelPath}`);

const panel = fs.readFileSync(panelPath, "utf8");

for (const contract of [
  "function renderAskAnswer",
  "function renderInlineMarkdown",
  "part.startsWith(\"**\")",
  "line.match(/^[-*]\\s+(.+)$/)",
  "line.match(/^(\\d+)\\.\\s+(.+)$/)",
  "renderAskAnswer(result.answer)",
]) {
  if (!panel.includes(contract)) throw new Error(`Ask Loombus formatting contract missing: ${contract}`);
}

for (const forbidden of ["dangerouslySetInnerHTML", "react-markdown", "marked(", ".innerHTML"] ) {
  if (panel.includes(forbidden)) throw new Error(`Unsafe or unapproved Ask Loombus formatting token found: ${forbidden}`);
}

console.log("PASS: Ask Loombus answer formatting contracts verified.");
