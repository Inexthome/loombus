"use client";

import { useEffect } from "react";

type Panel = "topic" | "mode" | "attachments" | "guidance" | "more" | null;

const CSS = String.raw`
@media (max-width:767px){
  [data-mc-global-hidden="true"]{display:none!important}
  body[data-create-focus-mode="true"]{background:radial-gradient(circle at 10% 0%,var(--loombus-cream-soft),transparent 20rem),radial-gradient(circle at 90% 5%,var(--loombus-gold-soft),transparent 22rem),var(--loombus-page-bg)!important}
  main[data-mobile-create]{min-height:100dvh!important;padding:0 0 calc(6.5rem + env(safe-area-inset-bottom))!important;background:transparent!important;color:var(--loombus-text)!important}
  main[data-mobile-create]>section{max-width:none!important}
  main[data-mobile-create] [data-mc-role="desktop-header"]{display:none!important}
  main[data-mobile-create] form{display:block!important}
  main[data-mobile-create] form>div:first-child{display:block!important}
  main[data-mobile-create] form>div:first-child>section:first-of-type{position:relative!important;overflow:hidden!important;margin:.8rem 1rem 0!important;border:1px solid color-mix(in srgb,var(--loombus-gold) 32%,var(--loombus-border))!important;border-radius:1.75rem!important;padding:0!important;background:radial-gradient(circle at 0 0,var(--loombus-cream-soft),transparent 18rem),radial-gradient(circle at 100% 0,var(--loombus-gold-soft),transparent 19rem),var(--loombus-surface)!important;box-shadow:0 1.25rem 3.5rem rgb(0 0 0/.1)!important}
  main[data-mobile-create] form>div:first-child>section:first-of-type:before{content:"";position:absolute;inset:0 1.7rem auto;height:3px;border-radius:0 0 999px 999px;background:linear-gradient(90deg,transparent,var(--loombus-gold),transparent)}
  main[data-mobile-create] form>div:first-child>section:first-of-type>.grid{display:flex!important;flex-direction:column!important;gap:0!important}
  .mc-intro{display:flex;align-items:center;gap:.75rem;padding:1.15rem 1rem .8rem}
  .mc-intro-mark{display:grid;size:2.4rem;width:2.4rem;height:2.4rem;place-items:center;border:1px solid color-mix(in srgb,var(--loombus-gold) 45%,var(--loombus-border));border-radius:.9rem;background:var(--loombus-gold-surface);color:var(--loombus-gold-deep);font-weight:950}
  .mc-intro-copy{display:grid;gap:.15rem}.mc-intro-copy strong{color:var(--loombus-text);font-size:.86rem;font-weight:950}.mc-intro-copy span{color:var(--loombus-text-muted);font-size:.7rem;line-height:1.35}
  main[data-mobile-create] [data-mc-role="title"]{order:1;margin:0!important;padding:.95rem 1rem 1rem!important;border-top:1px solid color-mix(in srgb,var(--loombus-gold) 15%,var(--loombus-border));border-bottom:1px solid var(--loombus-border)}
  main[data-mobile-create] [data-mc-role="title"]>span{display:block!important;margin:0 0 .55rem!important;color:var(--loombus-gold-deep)!important;font-size:.68rem!important;font-weight:950!important;letter-spacing:.14em!important;text-transform:uppercase!important}
  main[data-mobile-create] [data-mc-role="title"]>p{display:block!important;margin:.5rem .15rem 0!important;color:var(--loombus-text-subtle)!important;font-size:.68rem!important}
  main[data-mobile-create] [data-mc-role="title"] input{width:100%!important;min-height:3.3rem!important;border:1px solid var(--loombus-border)!important;border-radius:1rem!important;background:color-mix(in srgb,var(--loombus-surface-strong) 88%,var(--loombus-cream-soft))!important;padding:.85rem .95rem!important;color:var(--loombus-text)!important;font-size:1rem!important;font-weight:850!important;outline:none!important}
  main[data-mobile-create] [data-mc-role="body"]{order:2;margin:0!important;padding:1rem!important}
  main[data-mobile-create] [data-mc-role="body"]>div{margin:0 0 .55rem!important}
  main[data-mobile-create] [data-mc-role="body"]>div>span:first-child{color:var(--loombus-gold-deep)!important;font-size:.68rem!important;font-weight:950!important;letter-spacing:.14em!important;text-transform:uppercase!important}
  main[data-mobile-create] [data-mc-role="body"]>div>span:last-child{color:var(--loombus-text-subtle)!important;font-size:.68rem!important;font-weight:800!important}
  main[data-mobile-create] [data-mc-role="body"] textarea{width:100%!important;min-height:14rem!important;resize:none!important;border:1px solid var(--loombus-border)!important;border-radius:1.15rem!important;background:color-mix(in srgb,var(--loombus-surface-strong) 88%,var(--loombus-cream-soft))!important;padding:1rem!important;color:var(--loombus-text)!important;font-size:.98rem!important;line-height:1.65rem!important;outline:none!important}
  main[data-mobile-create] [data-mc-role="title"] input:focus,main[data-mobile-create] [data-mc-role="body"] textarea:focus{border-color:var(--loombus-gold)!important;box-shadow:0 0 0 4px var(--loombus-gold-soft)!important}
  main[data-mobile-create] [data-mc-role="body"]>p{margin:.55rem .15rem 0!important;color:var(--loombus-text-muted)!important;font-size:.7rem!important}
  main[data-mobile-create] [data-mc-role="topic"],main[data-mobile-create] [data-mc-role="mode"],main[data-mobile-create] [data-mc-role="mode-guide"],main[data-mobile-create] [data-mc-role="purpose"],main[data-mobile-create] [data-mc-role="guidance"],main[data-mobile-create] [data-mc-role="tags"],main[data-mobile-create] [data-mc-role="attachments"],main[data-mobile-create] [data-mc-role="aside"],main[data-mobile-create] [data-mc-role="extra"]{display:none!important}
  main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="purpose"],main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="tags"]{display:block!important;order:3;margin:0!important;padding:1rem!important;border-top:1px solid var(--loombus-border);background:var(--loombus-surface-strong)!important}
  main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="purpose"] .text-red-500{display:none!important}
  main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="purpose"]>span:first-child:after{content:" (optional)";font-weight:650;color:var(--loombus-text-muted)}
  .mc-header{position:sticky;top:0;z-index:66;border-bottom:1px solid color-mix(in srgb,var(--loombus-gold) 22%,var(--loombus-border));padding:.7rem 1rem;background:color-mix(in srgb,var(--loombus-page-bg) 94%,transparent);backdrop-filter:blur(22px)}
  .mc-header-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:.6rem;max-width:42rem;margin:0 auto}.mc-cancel{justify-self:start;color:var(--loombus-text-muted);font-size:.82rem;font-weight:850;text-decoration:none}.mc-title{color:var(--loombus-text);font-size:1rem;font-weight:950;white-space:nowrap}.mc-draft{justify-self:end;border:1px solid var(--loombus-border);border-radius:999px;padding:.45rem .65rem;background:var(--loombus-surface);color:var(--loombus-text-muted);font-size:.7rem;font-weight:850}
  .mc-context{max-width:42rem;margin:0 auto;padding:.9rem 1rem 0}.mc-context-label{margin:0 0 .55rem .15rem;color:var(--loombus-text-subtle);font-size:.62rem;font-weight:950;letter-spacing:.15em;text-transform:uppercase}.mc-context-row{display:flex;gap:.55rem;overflow-x:auto}.mc-chip{min-height:2.85rem;flex:0 0 auto;border:1px solid var(--loombus-border);border-radius:999px;padding:.65rem .9rem;background:var(--loombus-surface);color:var(--loombus-text);font-size:.75rem;font-weight:900}.mc-chip[data-configured="true"]{border-color:var(--loombus-gold);background:var(--loombus-gold-surface);color:var(--loombus-gold-deep)}
  .mc-bar{position:fixed;inset-inline:0;bottom:0;z-index:68;border-top:1px solid var(--loombus-border);padding:.55rem .75rem calc(env(safe-area-inset-bottom) + .55rem);background:color-mix(in srgb,var(--loombus-page-bg) 94%,transparent);backdrop-filter:blur(24px)}.mc-bar-row{display:grid;grid-template-columns:repeat(3,1fr) 1.35fr;gap:.45rem;max-width:42rem;margin:0 auto}.mc-bar button{min-height:3rem;border:0;border-radius:1rem;background:transparent;color:var(--loombus-text-muted);font-size:.7rem;font-weight:900}.mc-bar .mc-review{background:var(--loombus-gold);color:var(--loombus-gold-contrast);font-size:.82rem}
  .mc-backdrop{position:fixed;inset:0;z-index:79;border:0;background:rgb(9 9 11/.58)}
  main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"],main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"],main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"],main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"]{display:block!important;position:fixed!important;inset-inline:0!important;bottom:0!important;z-index:81!important;width:100%!important;max-height:min(78dvh,44rem)!important;overflow-y:auto!important;overscroll-behavior:contain!important;margin:0!important;border:1px solid color-mix(in srgb,var(--loombus-gold) 25%,var(--loombus-border))!important;border-bottom:0!important;border-radius:1.75rem 1.75rem 0 0!important;background:radial-gradient(circle at 8% 0,var(--loombus-cream-soft),transparent 17rem),radial-gradient(circle at 92% 0,var(--loombus-gold-soft),transparent 18rem),var(--loombus-surface)!important;color:var(--loombus-text)!important;padding:5rem 1rem calc(1rem + env(safe-area-inset-bottom))!important;box-shadow:0 -1.5rem 5rem rgb(0 0 0/.3)!important}
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"]{max-height:min(62dvh,34rem)!important}
  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"]{padding-bottom:calc(5.5rem + env(safe-area-inset-bottom))!important}
  main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"]>span,main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"]>p:first-child,main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"]>p:first-child,main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] h2{display:none!important}
  main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"] .absolute{position:static!important;margin-top:.75rem!important;background:var(--loombus-surface-strong)!important;box-shadow:none!important}
  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"]>div{grid-template-columns:1fr!important}
  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"] button,main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"] button{color:var(--loombus-text)!important}
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] p,main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] strong,main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] span{color:var(--loombus-text-muted)!important}
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] button{width:100%!important;min-height:3.15rem!important;border:1px solid var(--loombus-border)!important;border-radius:1rem!important;background:var(--loombus-surface-strong)!important;color:var(--loombus-text)!important}
  .mc-sheet-head{position:fixed;inset-inline:0;z-index:83;pointer-events:none}.mc-sheet-head-row{display:flex;align-items:center;justify-content:space-between;height:4.8rem;border:1px solid var(--loombus-border);border-bottom:1px solid var(--loombus-border);border-radius:1.75rem 1.75rem 0 0;padding:1rem;background:var(--loombus-surface-strong);color:var(--loombus-text);pointer-events:auto}.mc-sheet-head strong{font-size:1rem;font-weight:950}.mc-close{display:grid;width:2.7rem;height:2.7rem;place-items:center;border:1px solid var(--loombus-border);border-radius:999px;background:var(--loombus-surface-muted);color:var(--loombus-text);font-size:1.3rem}
  .mc-more{position:fixed;inset-inline:0;bottom:0;z-index:81;max-height:min(68dvh,36rem);overflow-y:auto;border:1px solid var(--loombus-border);border-bottom:0;border-radius:1.75rem 1.75rem 0 0;padding:5rem 1rem calc(1rem + env(safe-area-inset-bottom));background:var(--loombus-surface);color:var(--loombus-text);box-shadow:0 -1.5rem 5rem rgb(0 0 0/.3)}.mc-more-inner{display:grid;gap:.8rem;max-width:42rem;margin:0 auto}.mc-group-label{margin:.35rem .15rem;color:var(--loombus-gold-deep);font-size:.62rem;font-weight:950;letter-spacing:.15em;text-transform:uppercase}.mc-menu{display:flex;width:100%;align-items:center;justify-content:space-between;gap:1rem;border:1px solid var(--loombus-border);border-radius:1rem;padding:.85rem;background:var(--loombus-surface-strong);color:var(--loombus-text);text-align:left}.mc-menu strong{display:block;color:var(--loombus-text);font-size:.8rem}.mc-menu span{display:block;margin-top:.18rem;color:var(--loombus-text-muted);font-size:.67rem}.mc-menu-danger strong{color:#ef4444}.mc-menu-primary{border-color:var(--loombus-gold);background:var(--loombus-gold)}.mc-menu-primary strong,.mc-menu-primary span{color:var(--loombus-gold-contrast)}
  .mc-mode-foot{position:fixed;inset-inline:0;bottom:calc(env(safe-area-inset-bottom) + .65rem);z-index:84;padding:0 1rem}.mc-mode-foot button{display:block;width:min(100%,42rem);min-height:3.15rem;margin:0 auto;border:1px solid var(--loombus-gold);border-radius:1rem;background:var(--loombus-gold);color:var(--loombus-gold-contrast);font-size:.78rem;font-weight:950}
}
`;

function rootForCreate() {
  return Array.from(document.querySelectorAll<HTMLElement>("main")).find(
    (main) => main.querySelector("h1")?.textContent?.trim() === "Create Discussion"
  ) ?? null;
}

function starts(element: Element, value: string) {
  return element.textContent?.trim().startsWith(value) ?? false;
}

function originalButton(root: Element, labels: string[]) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => !button.closest("[data-mc-ui]") && labels.some((label) => starts(button, label))
  );
}

function role(element: Element | null | undefined, name: string) {
  if (element instanceof HTMLElement) element.dataset.mcRole = name;
}

function mark(root: HTMLElement) {
  const form = root.querySelector("form");
  const primary = form?.firstElementChild;
  const first = primary?.querySelector(":scope > section:first-of-type");
  const inputs = Array.from(first?.querySelectorAll<HTMLInputElement>('input:not([type]),input[type="text"],input[type="search"]') ?? []);
  const title = inputs.find((input) => input.placeholder.toLowerCase().includes("future") || input.closest("label")?.textContent?.includes("Discussion Title"));
  const tags = inputs.find((input) => input.placeholder.toLowerCase().includes("web3") || input.closest("label")?.textContent?.trim().startsWith("Tags"));
  const body = Array.from(first?.querySelectorAll<HTMLTextAreaElement>("textarea") ?? []).find((textarea) => textarea.placeholder.toLowerCase().includes("provide context") || textarea.closest("label")?.textContent?.includes("Body"));
  const topicButton = Array.from(first?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.includes("Choose an approved topic") || button.querySelector("svg")?.getAttribute("class")?.includes("lucide-plus"));
  const modeButton = Array.from(first?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => starts(button, "Open Discussion"));
  const guidanceHeading = Array.from(first?.querySelectorAll("h2") ?? []).find((heading) => heading.textContent?.includes("AI draft tools") || heading.textContent?.includes("Draft Guidance"));
  const attachment = form?.querySelector<HTMLInputElement>('input[type="file"][accept="video/*"]')?.closest("section");
  const purpose = Array.from(first?.querySelectorAll<HTMLInputElement>("input") ?? []).find((input) => input.dataset.loombusPurposeInput === "true" || input.placeholder.includes("hope to achieve"));
  role(root.querySelector(":scope > section > header"), "desktop-header");
  role(title?.closest("label"), "title");
  role(body?.closest("label"), "body");
  role(topicButton?.closest("div.relative"), "topic");
  role(modeButton?.parentElement?.parentElement, "mode");
  role(first?.querySelector('[data-loombus-mode-guidance="true"]'), "mode-guide");
  role(purpose?.closest("label"), "purpose");
  role(tags?.closest("label"), "tags");
  role(guidanceHeading?.closest("section"), "guidance");
  role(attachment, "attachments");
  role(form?.querySelector("aside"), "aside");
  if (primary) for (const section of Array.from(primary.querySelectorAll(":scope > section"))) if (section !== first && section !== attachment) role(section, "extra");
}

function topicLabel(root: HTMLElement) {
  const button = root.querySelector('[data-mc-role="topic"] > button');
  const value = button?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return !value || value.includes("Choose an approved topic") ? "Topic" : value.replace(/^\+\s*/, "");
}

function modeLabel(root: HTMLElement) {
  const area = root.querySelector('[data-mc-role="mode"]');
  const selected = Array.from(area?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.getAttribute("aria-pressed") === "true" || button.className.includes("border-amber-400"));
  return ["Open Discussion", "Debate", "Research Question", "Problem Solving"].find((label) => selected ? starts(selected, label) : false) ?? "Open Discussion";
}

function makeButton(label: string, className: string, action: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", action);
  return button;
}

function menuButton(title: string, detail: string, className: string, action: () => void) {
  const button = makeButton("", `mc-menu ${className}`, action);
  const copy = document.createElement("span");
  const strong = document.createElement("strong");
  const small = document.createElement("span");
  strong.textContent = title;
  small.textContent = detail;
  copy.append(strong, small);
  button.append(copy);
  return { button, strong };
}

export function CreateMobileComposerAdapter() {
  useEffect(() => {
    const media = window.matchMedia("(max-width:767px)");
    let cleanup: (() => void) | null = null;

    const activate = () => {
      cleanup?.();
      cleanup = null;
      if (!media.matches) return;

      let cancelled = false;
      let locateTimer = 0;
      const locate = () => {
        if (cancelled) return;
        const root = rootForCreate();
        if (!root) {
          locateTimer = window.setTimeout(locate, 100);
          return;
        }

        mark(root);
        root.dataset.mobileCreate = "true";
        document.body.dataset.createFocusMode = "true";

        const hiddenGlobals = new Set<HTMLElement>();
        for (const element of document.querySelectorAll<HTMLElement>('.loombus-mobile-v2-topbar,.loombus-mobile-v2-bottom-nav,.loombus-floating-utility-stack,button[aria-label="Open messages"],button[aria-label="Close messages"],aside[aria-label="Messages preview"]')) {
          element.dataset.mcGlobalHidden = "true";
          hiddenGlobals.add(element);
        }

        const style = document.createElement("style");
        style.dataset.mcUi = "true";
        style.textContent = CSS;
        document.head.append(style);

        const first = root.querySelector<HTMLElement>("form > div:first-child > section:first-of-type");
        const grid = first?.querySelector<HTMLElement>(":scope > .grid");
        const top = document.createElement("header");
        const intro = document.createElement("div");
        const context = document.createElement("section");
        const bottom = document.createElement("div");
        const shade = document.createElement("button");
        const sheetHead = document.createElement("div");
        const more = document.createElement("section");
        const modeFoot = document.createElement("div");
        for (const element of [top, intro, context, bottom, shade, sheetHead, more, modeFoot]) element.dataset.mcUi = "true";

        top.className = "mc-header";
        const topRow = document.createElement("div");
        topRow.className = "mc-header-row";
        const cancel = document.createElement("a");
        cancel.href = "/discussions";
        cancel.textContent = "Cancel";
        cancel.className = "mc-cancel";
        const heading = document.createElement("strong");
        heading.textContent = "Create Discussion";
        heading.className = "mc-title";
        const draft = makeButton("Draft", "mc-draft", () => originalButton(root, ["Save Draft", "Saving"])?.click());
        topRow.append(cancel, heading, draft);
        top.append(topRow);
        first?.insertAdjacentElement("beforebegin", top);

        intro.className = "mc-intro";
        const introMark = document.createElement("span");
        introMark.className = "mc-intro-mark";
        introMark.textContent = "✦";
        const introCopy = document.createElement("span");
        introCopy.className = "mc-intro-copy";
        const introTitle = document.createElement("strong");
        introTitle.textContent = "Start with the idea";
        const introDetail = document.createElement("span");
        introDetail.textContent = "Give members a clear title, then add the context needed for a useful discussion.";
        introCopy.append(introTitle, introDetail);
        intro.append(introMark, introCopy);
        first?.insertBefore(intro, grid ?? first.firstChild);

        let panel: Panel = null;
        let previousFocus: HTMLElement | null = null;
        let previousOverflow = "";

        context.className = "mc-context";
        const contextLabel = document.createElement("p");
        contextLabel.className = "mc-context-label";
        contextLabel.textContent = "Discussion setup";
        const contextRow = document.createElement("div");
        contextRow.className = "mc-context-row";
        const topic = makeButton("Topic", "mc-chip", () => open("topic"));
        const mode = makeButton("Open Discussion", "mc-chip", () => open("mode"));
        const add = makeButton("Add", "mc-chip", () => open("attachments"));
        mode.dataset.configured = "true";
        contextRow.append(topic, mode, add);
        context.append(contextLabel, contextRow);
        first?.insertAdjacentElement("afterend", context);

        bottom.className = "mc-bar";
        const bottomRow = document.createElement("div");
        bottomRow.className = "mc-bar-row";
        bottomRow.append(
          makeButton("Attach", "", () => open("attachments")),
          makeButton("Guidance", "", () => open("guidance")),
          makeButton("More", "", () => open("more")),
          makeButton("Review", "mc-review", () => originalButton(root, ["Review draft"])?.click())
        );
        bottom.append(bottomRow);
        document.body.append(bottom);

        shade.type = "button";
        shade.className = "mc-backdrop";
        shade.hidden = true;
        shade.setAttribute("aria-label", "Close composer options");
        shade.addEventListener("click", close);
        document.body.append(shade);

        sheetHead.className = "mc-sheet-head";
        sheetHead.hidden = true;
        const sheetHeadRow = document.createElement("div");
        sheetHeadRow.className = "mc-sheet-head-row";
        const panelTitle = document.createElement("strong");
        panelTitle.id = "mc-sheet-title";
        const closeButton = makeButton("×", "mc-close", close);
        closeButton.setAttribute("aria-label", "Close options");
        sheetHeadRow.append(panelTitle, closeButton);
        sheetHead.append(sheetHeadRow);
        document.body.append(sheetHead);

        more.className = "mc-more";
        more.hidden = true;
        more.setAttribute("role", "dialog");
        more.setAttribute("aria-modal", "true");
        more.setAttribute("aria-labelledby", panelTitle.id);
        const moreInner = document.createElement("div");
        moreInner.className = "mc-more-inner";
        const writingLabel = document.createElement("p");
        writingLabel.className = "mc-group-label";
        writingLabel.textContent = "Writing options";
        const advanced = menuButton("Show response goal and tags", "Add optional intent and discovery details.", "", () => {
          const show = root.dataset.mcAdvanced !== "true";
          root.dataset.mcAdvanced = show ? "true" : "false";
          advanced.strong.textContent = show ? "Hide response goal and tags" : "Show response goal and tags";
          close();
        });
        const draftLabel = document.createElement("p");
        draftLabel.className = "mc-group-label";
        draftLabel.textContent = "Draft";
        const save = menuButton("Save draft", "Store the current draft.", "", () => { originalButton(root, ["Save Draft", "Saving"])?.click(); close(); });
        const copy = menuButton("Copy draft", "Copy the title, setup, and body.", "", () => { originalButton(root, ["Copy draft"])?.click(); close(); });
        const clear = menuButton("Clear draft", "Remove the current draft and staged context.", "mc-menu-danger", () => { originalButton(root, ["Clear"])?.click(); close(); });
        const publishLabel = document.createElement("p");
        publishLabel.className = "mc-group-label";
        publishLabel.textContent = "Publishing";
        const publish = menuButton("Publish now", "Run the existing validation and publish.", "mc-menu-primary", () => { originalButton(root, ["Publish", "Publishing"])?.click(); close(); });
        moreInner.append(writingLabel, advanced.button, draftLabel, save.button, copy.button, clear.button, publishLabel, publish.button);
        more.append(moreInner);
        document.body.append(more);

        modeFoot.className = "mc-mode-foot";
        modeFoot.hidden = true;
        modeFoot.append(makeButton("Use selected mode structure", "", () => root.querySelector<HTMLButtonElement>('[data-loombus-insert-structure="true"]')?.click()));
        document.body.append(modeFoot);

        function activePanel() {
          if (panel === "more") return more;
          const roleName = panel === "topic" ? "topic" : panel === "mode" ? "mode" : panel === "attachments" ? "attachments" : panel === "guidance" ? "guidance" : "";
          return roleName ? root.querySelector<HTMLElement>(`[data-mc-role="${roleName}"]`) : null;
        }

        function positionHeader() {
          const target = activePanel();
          if (!target || !panel) return;
          sheetHead.style.top = `${Math.max(0, target.getBoundingClientRect().top)}px`;
        }

        function close() {
          const target = activePanel();
          target?.removeAttribute("role");
          target?.removeAttribute("aria-modal");
          target?.removeAttribute("aria-labelledby");
          panel = null;
          delete root.dataset.mcPanel;
          shade.hidden = true;
          sheetHead.hidden = true;
          more.hidden = true;
          modeFoot.hidden = true;
          document.body.style.overflow = previousOverflow;
          previousFocus?.focus({ preventScroll: true });
          previousFocus = null;
        }

        function open(next: Exclude<Panel, null>) {
          if (panel) close();
          panel = next;
          previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          previousOverflow = document.body.style.overflow;
          root.dataset.mcPanel = next;
          panelTitle.textContent = next === "topic" ? "Topic and classification" : next === "mode" ? "Discussion mode" : next === "attachments" ? "Add supporting context" : next === "guidance" ? "Draft Guidance" : "More options";
          shade.hidden = false;
          sheetHead.hidden = false;
          more.hidden = next !== "more";
          modeFoot.hidden = next !== "mode";
          document.body.style.overflow = "hidden";
          if (next === "topic") {
            const area = root.querySelector('[data-mc-role="topic"]');
            if (!area?.querySelector(".absolute")) area?.querySelector<HTMLButtonElement>(":scope > button")?.click();
          }
          const target = activePanel();
          if (target && target !== more) {
            target.setAttribute("role", "dialog");
            target.setAttribute("aria-modal", "true");
            target.setAttribute("aria-labelledby", panelTitle.id);
          }
          window.requestAnimationFrame(() => { positionHeader(); closeButton.focus(); });
        }

        function sync() {
          mark(root);
          const topicValue = topicLabel(root);
          topic.textContent = topicValue;
          topic.dataset.configured = topicValue === "Topic" ? "false" : "true";
          mode.textContent = modeLabel(root);
          const attachment = root.querySelector('[data-mc-role="attachments"]');
          const count = attachment?.querySelectorAll('button[aria-label^="Remove "]').length ?? 0;
          add.textContent = count ? `Add · ${count}` : "Add";
          add.dataset.configured = count ? "true" : "false";
          const statusText = root.querySelector('[data-mc-role="aside"] section:nth-child(2) p')?.textContent?.toLowerCase() ?? "";
          draft.textContent = statusText.includes("saving") ? "Saving…" : statusText.includes("saved") ? "Saved" : statusText.includes("local") ? "Local" : "Draft";
          save.button.disabled = Boolean(originalButton(root, ["Save Draft", "Saving"])?.disabled);
          copy.button.disabled = Boolean(originalButton(root, ["Copy draft"])?.disabled);
          clear.button.disabled = Boolean(originalButton(root, ["Clear"])?.disabled);
          publish.button.disabled = Boolean(originalButton(root, ["Publish", "Publishing"])?.disabled);
          if (panel) window.requestAnimationFrame(positionHeader);
        }

        function activity(event: Event) {
          const clicked = (event.target as Element | null)?.closest("button");
          if (clicked?.closest('[data-mc-role="mode"]') && ["Open Discussion", "Debate", "Research Question", "Problem Solving"].some((label) => starts(clicked, label))) window.setTimeout(close, 0);
          window.setTimeout(sync, 0);
        }

        function keydown(event: KeyboardEvent) {
          if (panel && event.key === "Escape") { event.preventDefault(); close(); }
        }

        root.addEventListener("click", activity, true);
        root.addEventListener("input", activity, true);
        root.addEventListener("change", activity, true);
        document.addEventListener("keydown", keydown);
        window.addEventListener("resize", positionHeader);
        window.visualViewport?.addEventListener("resize", positionHeader);
        const statusTimer = window.setInterval(sync, 1200);
        sync();

        cleanup = () => {
          cancelled = true;
          window.clearTimeout(locateTimer);
          window.clearInterval(statusTimer);
          root.removeEventListener("click", activity, true);
          root.removeEventListener("input", activity, true);
          root.removeEventListener("change", activity, true);
          document.removeEventListener("keydown", keydown);
          window.removeEventListener("resize", positionHeader);
          window.visualViewport?.removeEventListener("resize", positionHeader);
          delete root.dataset.mobileCreate;
          delete root.dataset.mcPanel;
          delete root.dataset.mcAdvanced;
          for (const element of root.querySelectorAll<HTMLElement>("[data-mc-role]")) delete element.dataset.mcRole;
          delete document.body.dataset.createFocusMode;
          for (const element of hiddenGlobals) delete element.dataset.mcGlobalHidden;
          for (const element of [style, top, intro, context, bottom, shade, sheetHead, more, modeFoot]) element.remove();
          document.body.style.overflow = previousOverflow;
        };
      };

      locate();
      if (!cleanup) cleanup = () => { cancelled = true; window.clearTimeout(locateTimer); };
    };

    activate();
    media.addEventListener("change", activate);
    return () => { media.removeEventListener("change", activate); cleanup?.(); };
  }, []);

  return null;
}
