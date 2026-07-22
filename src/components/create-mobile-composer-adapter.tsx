"use client";

import { useEffect } from "react";

type Panel = "topic" | "mode" | "attachments" | "guidance" | "more" | null;

const CSS = String.raw`
@media (max-width:767px){
  main[data-mobile-create]{
    --mc-gold:#CBAB5B;
    --mc-cream:#FEFBEC;
    padding:0 0 calc(6.2rem + env(safe-area-inset-bottom))!important;
    background:
      radial-gradient(circle at 8% 0%,color-mix(in srgb,var(--mc-cream) 72%,transparent),transparent 18rem),
      radial-gradient(circle at 92% 2%,color-mix(in srgb,var(--mc-gold) 18%,transparent),transparent 20rem),
      var(--loombus-page-bg)!important;
    color:var(--loombus-text)!important;
  }
  main[data-mobile-create]>section{max-width:none!important}
  main[data-mobile-create] [data-mc-role="desktop-header"],
  main[data-mobile-create] [data-mc-role="mode-guide"],
  main[data-mobile-create] [data-mc-role="tags"],
  main[data-mobile-create] [data-mc-role="guidance"],
  main[data-mobile-create] [data-mc-role="attachments"],
  main[data-mobile-create] [data-mc-role="topic"],
  main[data-mobile-create] [data-mc-role="mode"],
  main[data-mobile-create] [data-mc-role="aside"],
  main[data-mobile-create] [data-mc-role="extra"]{display:none!important}
  main[data-mobile-create] form{display:block!important}
  main[data-mobile-create] form>div:first-child{display:block!important}
  main[data-mobile-create] form>div:first-child>section:first-of-type{
    margin:0 1rem!important;
    padding:0!important;
    overflow:hidden!important;
    border:1px solid color-mix(in srgb,var(--mc-gold) 34%,var(--loombus-border))!important;
    border-radius:1.75rem!important;
    background:
      radial-gradient(circle at 0 0,color-mix(in srgb,var(--mc-cream) 72%,transparent),transparent 18rem),
      radial-gradient(circle at 100% 0,color-mix(in srgb,var(--mc-gold) 15%,transparent),transparent 18rem),
      var(--loombus-surface)!important;
    box-shadow:0 1.2rem 3.2rem rgb(0 0 0/.10)!important;
  }
  main[data-mobile-create] form>div:first-child>section:first-of-type>.grid{
    display:flex!important;
    flex-direction:column!important;
    gap:0!important;
  }
  main[data-mobile-create] [data-mc-role="title"]{
    display:block!important;
    order:1!important;
    padding:1.15rem 1rem 1rem!important;
    border-bottom:1px solid var(--loombus-border)!important;
    background:color-mix(in srgb,var(--loombus-surface) 90%,var(--mc-cream))!important;
  }
  main[data-mobile-create] [data-mc-role="title"]>span,
  main[data-mobile-create] [data-mc-role="title"]>p{display:none!important}
  main[data-mobile-create] [data-mc-role="title"] input{
    border:0!important;
    background:transparent!important;
    color:var(--loombus-text)!important;
    padding:0!important;
    font-size:1.14rem!important;
    line-height:1.55rem!important;
    font-weight:850!important;
    box-shadow:none!important;
  }
  main[data-mobile-create] [data-mc-role="title"] input::placeholder,
  main[data-mobile-create] [data-mc-role="purpose"] input::placeholder,
  main[data-mobile-create] [data-mc-role="body"] textarea::placeholder{
    color:var(--loombus-text-subtle)!important;
    opacity:1!important;
  }
  main[data-mobile-create] [data-mc-role="purpose"]{
    display:block!important;
    order:2!important;
    padding:1rem!important;
    border-bottom:1px solid var(--loombus-border)!important;
    background:var(--loombus-surface)!important;
  }
  main[data-mobile-create] [data-mc-role="purpose"] .text-red-500{display:none!important}
  main[data-mobile-create] [data-mc-role="purpose"]>span:first-child:after{
    content:" (optional)";
    font-weight:600;
    color:var(--loombus-text-muted);
  }
  main[data-mobile-create] [data-mc-role="purpose"] input{
    min-height:3.2rem!important;
    border-color:var(--loombus-border)!important;
    background:color-mix(in srgb,var(--loombus-surface-strong) 86%,var(--mc-cream))!important;
    color:var(--loombus-text)!important;
  }
  main[data-mobile-create] [data-mc-role="body"]{
    display:block!important;
    order:3!important;
    padding:1rem!important;
    background:var(--loombus-surface)!important;
  }
  main[data-mobile-create] [data-mc-role="body"]>div{margin-bottom:.35rem!important}
  main[data-mobile-create] [data-mc-role="body"]>div>span:first-child{display:none!important}
  main[data-mobile-create] [data-mc-role="body"] textarea{
    min-height:14rem!important;
    resize:none!important;
    border:0!important;
    background:transparent!important;
    color:var(--loombus-text)!important;
    padding:0!important;
    font-size:1rem!important;
    line-height:1.72rem!important;
    box-shadow:none!important;
  }
  main[data-mobile-create] [data-mc-role="body"]>p{margin-top:.5rem!important}
  main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="tags"]{
    display:block!important;
    order:4!important;
    padding:1rem!important;
    border-top:1px solid var(--loombus-border)!important;
  }
  main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"],
  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"],
  main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"],
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"]{
    display:block!important;
    position:fixed!important;
    inset-inline:0!important;
    bottom:0!important;
    z-index:81!important;
    width:100%!important;
    height:auto!important;
    max-height:min(78dvh,44rem)!important;
    overflow-y:auto!important;
    overscroll-behavior:contain!important;
    margin:0!important;
    border:1px solid var(--loombus-border)!important;
    border-bottom:0!important;
    border-radius:2rem 2rem 0 0!important;
    background:
      radial-gradient(circle at 8% 0,color-mix(in srgb,var(--mc-cream) 66%,transparent),transparent 18rem),
      radial-gradient(circle at 92% 0,color-mix(in srgb,var(--mc-gold) 16%,transparent),transparent 18rem),
      var(--loombus-surface)!important;
    color:var(--loombus-text)!important;
    padding:5rem 1rem calc(1rem + env(safe-area-inset-bottom))!important;
    box-shadow:0 -1.25rem 4rem rgb(0 0 0/.28)!important;
  }
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"]{max-height:min(62dvh,34rem)!important}
  main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"]>span,
  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"]>p:first-child,
  main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"]>p:first-child,
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] h2{display:none!important}
  main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"] .absolute{position:static!important;margin-top:.75rem!important;box-shadow:none!important}
  main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"] .max-h-64{max-height:48vh!important}
  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"]{padding-bottom:6rem!important}
  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"]>div{grid-template-columns:1fr!important}
  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"] button,
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] button,
  main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"] button{
    border-color:var(--loombus-border)!important;
    background:var(--loombus-surface-strong)!important;
    color:var(--loombus-text)!important;
  }
  main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"]>div.mt-4.grid{grid-template-columns:1fr!important}
  body[data-create-focus="true"] [data-mobile-shell-topbar],
  body[data-create-focus="true"] [data-mobile-shell-bottomnav],
  body[data-create-focus="true"] [data-floating-utility],
  body[data-create-focus="true"] [data-floating-messages]{display:none!important}
}
`;

function starts(element: Element, value: string) {
  return element.textContent?.trim().startsWith(value) ?? false;
}

function findCreateRoot() {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("main")).find(
      (main) => main.querySelector("h1")?.textContent?.trim() === "Create Discussion"
    ) ?? null
  );
}

function originalButton(root: Element, labels: string[]) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) =>
      !button.closest("[data-mc-ui]") &&
      labels.some((label) => starts(button, label))
  );
}

function assignRole(element: Element | null | undefined, name: string) {
  if (element instanceof HTMLElement) element.dataset.mcRole = name;
}

function purposeInput(root: Element) {
  return Array.from(root.querySelectorAll<HTMLInputElement>("input")).find(
    (input) =>
      input.dataset.loombusPurposeInput === "true" ||
      input.placeholder.includes("hope to achieve") ||
      [
        "Discussion Purpose",
        "Debate Goal",
        "Research Goal",
        "Desired Outcome",
      ].some((label) => input.closest("label")?.textContent?.includes(label))
  );
}

function markComposer(root: HTMLElement) {
  const form = root.querySelector("form");
  const primary = form?.firstElementChild;
  const first = primary?.querySelector(":scope > section:first-of-type");
  const inputs = Array.from(first?.querySelectorAll<HTMLInputElement>("input") ?? []);
  const title = inputs.find((input) =>
    input.placeholder.toLowerCase().includes("future")
  );
  const tags = inputs.find((input) => input.placeholder.includes("web3"));
  const body = first?.querySelector("textarea");
  const topicButton = Array.from(
    first?.querySelectorAll<HTMLButtonElement>("button") ?? []
  ).find(
    (button) =>
      button.textContent?.includes("Choose an approved topic") ||
      button.querySelector("svg")?.className.baseVal?.includes("lucide-plus")
  );
  const modeButton = Array.from(
    first?.querySelectorAll<HTMLButtonElement>("button") ?? []
  ).find((button) => starts(button, "Open Discussion"));
  const guidanceHeading = Array.from(first?.querySelectorAll("h2") ?? []).find(
    (heading) =>
      heading.textContent?.includes("AI draft tools") ||
      heading.textContent?.includes("Draft Guidance")
  );
  const attachment = form
    ?.querySelector<HTMLInputElement>('input[type="file"][accept="video/*"]')
    ?.closest("section");

  assignRole(root.querySelector(":scope > section > header"), "desktop-header");
  assignRole(title?.closest("label"), "title");
  assignRole(purposeInput(first ?? root)?.closest("label"), "purpose");
  assignRole(body?.closest("label"), "body");
  assignRole(tags?.closest("label"), "tags");
  assignRole(topicButton?.closest("div.relative"), "topic");
  assignRole(modeButton?.parentElement?.parentElement, "mode");
  assignRole(first?.querySelector('[data-loombus-mode-guidance="true"]'), "mode-guide");
  assignRole(guidanceHeading?.closest("section"), "guidance");
  assignRole(attachment, "attachments");
  assignRole(form?.querySelector("aside"), "aside");

  if (primary) {
    for (const section of Array.from(primary.querySelectorAll(":scope > section"))) {
      if (section !== first && section !== attachment) assignRole(section, "extra");
    }
  }

  return first as HTMLElement | null;
}

function topicLabel(root: HTMLElement) {
  const area = root.querySelector('[data-mc-role="topic"]');
  const button = area?.querySelector<HTMLButtonElement>(":scope > button");
  const value = button?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return !value || value.includes("Choose an approved topic")
    ? "Topic"
    : value.replace(/^\+\s*/, "");
}

function modeLabel(root: HTMLElement) {
  const area = root.querySelector('[data-mc-role="mode"]');
  const selected = Array.from(
    area?.querySelectorAll<HTMLButtonElement>("button") ?? []
  ).find(
    (button) =>
      button.getAttribute("aria-pressed") === "true" ||
      button.className.includes("border-amber-400")
  );
  return (
    ["Open Discussion", "Debate", "Research Question", "Problem Solving"].find(
      (label) => (selected ? starts(selected, label) : false)
    ) ?? "Open Discussion"
  );
}

function makeButton(
  label: string,
  className: string,
  action: () => void
) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", action);
  return button;
}

export function CreateMobileComposerAdapter() {
  useEffect(() => {
    const media = window.matchMedia("(max-width:767px)");
    let teardown: (() => void) | null = null;

    const activate = () => {
      teardown?.();
      teardown = null;
      if (!media.matches) return;

      let cancelled = false;
      let locateTimer = 0;

      const locate = () => {
        if (cancelled) return;
        const root = findCreateRoot();
        if (!root) {
          locateTimer = window.setTimeout(locate, 120);
          return;
        }

        const composerCard = markComposer(root);
        if (!composerCard) {
          locateTimer = window.setTimeout(locate, 120);
          return;
        }

        root.dataset.mobileCreate = "true";
        document.body.dataset.createFocus = "true";

        const style = document.createElement("style");
        style.dataset.mcUi = "true";
        style.textContent = CSS;
        document.head.append(style);

        const header = document.createElement("div");
        const context = document.createElement("div");
        const footer = document.createElement("div");
        const overlay = document.createElement("button");
        const sheetHeader = document.createElement("div");
        const moreSheet = document.createElement("section");
        const modeFooter = document.createElement("div");

        for (const element of [
          header,
          context,
          footer,
          overlay,
          sheetHeader,
          moreSheet,
          modeFooter,
        ]) {
          element.dataset.mcUi = "true";
        }

        let panel: Panel = null;

        const closePanel = () => {
          panel = null;
          delete root.dataset.mcPanel;
          overlay.classList.add("hidden");
          sheetHeader.classList.add("hidden");
          moreSheet.classList.add("hidden");
          modeFooter.classList.add("hidden");
          document.body.style.overflow = "";
        };

        const openPanel = (next: Exclude<Panel, null>) => {
          panel = next;
          root.dataset.mcPanel = next;
          overlay.classList.remove("hidden");
          sheetHeader.classList.remove("hidden");
          moreSheet.classList.toggle("hidden", next !== "more");
          modeFooter.classList.toggle("hidden", next !== "mode");
          panelTitle.textContent =
            next === "topic"
              ? "Topic and classification"
              : next === "mode"
                ? "Discussion mode"
                : next === "attachments"
                  ? "Add supporting context"
                  : next === "guidance"
                    ? "Draft Guidance"
                    : "More options";
          document.body.style.overflow = "hidden";

          if (next === "topic") {
            const area = root.querySelector('[data-mc-role="topic"]');
            if (!area?.querySelector(".absolute")) {
              area
                ?.querySelector<HTMLButtonElement>(":scope > button")
                ?.click();
            }
          }
        };

        header.className =
          "px-4 pb-3 pt-[calc(env(safe-area-inset-top)+.75rem)]";
        const headerRow = document.createElement("div");
        headerRow.className =
          "mx-auto grid max-w-2xl grid-cols-[1fr_auto_1fr] items-center gap-3";
        const cancel = document.createElement("a");
        cancel.href = "/discussions";
        cancel.textContent = "Cancel";
        cancel.className =
          "justify-self-start px-2 py-2 text-sm font-bold text-[var(--loombus-text-muted)]";
        const heading = document.createElement("strong");
        heading.textContent = "Create Discussion";
        heading.className =
          "text-center text-base font-black text-[var(--loombus-text)]";
        const draft = makeButton(
          "Saved",
          "justify-self-end px-2 py-2 text-right text-xs font-black text-[#8a7130] dark:text-[#CBAB5B]",
          () => originalButton(root, ["Save Draft", "Saving"])?.click()
        );
        headerRow.append(cancel, heading, draft);
        header.append(headerRow);

        context.className = "px-4 pb-3";
        const contextRow = document.createElement("div");
        contextRow.className = "mx-auto grid max-w-2xl grid-cols-3 gap-2";
        const topic = makeButton(
          "Topic",
          "min-h-11 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm font-black text-[var(--loombus-text)]",
          () => openPanel("topic")
        );
        const mode = makeButton(
          "Open Discussion",
          "min-h-11 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm font-black text-[var(--loombus-text)]",
          () => openPanel("mode")
        );
        const add = makeButton(
          "Add",
          "min-h-11 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm font-black text-[var(--loombus-text)]",
          () => openPanel("attachments")
        );
        contextRow.append(topic, mode, add);
        context.append(contextRow);

        composerCard.insertAdjacentElement("beforebegin", context);
        context.insertAdjacentElement("beforebegin", header);

        footer.className =
          "fixed inset-x-0 bottom-0 z-[65] border-t border-[var(--loombus-border)] bg-[color:color-mix(in_srgb,var(--loombus-page-bg)_95%,transparent)] px-3 pb-[calc(env(safe-area-inset-bottom)+.65rem)] pt-2 backdrop-blur-xl";
        const footerRow = document.createElement("div");
        footerRow.className =
          "mx-auto grid max-w-2xl grid-cols-[1fr_1fr_1.35fr] gap-2";
        const quietAction =
          "min-h-12 rounded-2xl bg-[var(--loombus-surface)] text-xs font-black text-[var(--loombus-text-muted)]";
        footerRow.append(
          makeButton("Guidance", quietAction, () => openPanel("guidance")),
          makeButton("More", quietAction, () => openPanel("more")),
          makeButton(
            "Review",
            "min-h-12 rounded-2xl bg-[#CBAB5B] px-4 text-sm font-black text-[#17140c] shadow-lg shadow-black/10",
            () => originalButton(root, ["Review draft"])?.click()
          )
        );
        footer.append(footerRow);
        document.body.append(footer);

        overlay.type = "button";
        overlay.ariaLabel = "Close composer options";
        overlay.className = "fixed inset-0 z-[79] hidden bg-black/55";
        overlay.addEventListener("click", closePanel);
        document.body.append(overlay);

        sheetHeader.className =
          "pointer-events-none fixed inset-x-0 bottom-0 z-[83] hidden";
        const sheetHeaderRow = document.createElement("div");
        sheetHeaderRow.className =
          "pointer-events-auto mx-auto flex h-[4.7rem] max-w-2xl items-center justify-between rounded-t-[2rem] border border-b-0 border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-4 text-[var(--loombus-text)]";
        const panelTitle = document.createElement("strong");
        panelTitle.className = "text-lg font-black";
        const close = makeButton(
          "×",
          "grid size-10 place-items-center rounded-full bg-[var(--loombus-surface-muted)] text-xl text-[var(--loombus-text-muted)]",
          closePanel
        );
        sheetHeaderRow.append(panelTitle, close);
        sheetHeader.append(sheetHeaderRow);
        document.body.append(sheetHeader);

        moreSheet.className =
          "fixed inset-x-0 bottom-0 z-[81] hidden max-h-[68dvh] overflow-y-auto rounded-t-[2rem] border border-b-0 border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[5.4rem] text-[var(--loombus-text)] shadow-2xl";
        const moreInner = document.createElement("div");
        moreInner.className = "mx-auto grid max-w-2xl gap-3";
        const showTags = makeButton(
          "Show tags",
          "rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-4 py-3 text-sm font-black text-[var(--loombus-text)]",
          () => {
            root.dataset.mcAdvanced =
              root.dataset.mcAdvanced === "true" ? "false" : "true";
            closePanel();
          }
        );
        moreInner.append(
          showTags,
          makeButton(
            "Save draft",
            "rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-4 py-3 text-sm font-black text-[var(--loombus-text)]",
            () => originalButton(root, ["Save Draft", "Saving"])?.click()
          ),
          makeButton(
            "Copy draft",
            "rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-4 py-3 text-sm font-black text-[var(--loombus-text)]",
            () => originalButton(root, ["Copy draft"])?.click()
          ),
          makeButton(
            "Clear draft",
            "rounded-2xl border border-red-300 px-4 py-3 text-sm font-black text-red-500",
            () => originalButton(root, ["Clear"])?.click()
          ),
          makeButton(
            "Publish now",
            "rounded-2xl bg-[#CBAB5B] px-4 py-3 text-sm font-black text-[#17140c]",
            () => originalButton(root, ["Publish", "Publishing"])?.click()
          )
        );
        moreSheet.append(moreInner);
        document.body.append(moreSheet);

        modeFooter.className =
          "fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+.8rem)] z-[84] hidden px-4";
        modeFooter.append(
          makeButton(
            "Use selected mode structure",
            "mx-auto block w-full max-w-2xl rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm font-black text-[var(--loombus-text)]",
            () =>
              root
                .querySelector<HTMLButtonElement>(
                  '[data-loombus-insert-structure="true"]'
                )
                ?.click()
          )
        );
        document.body.append(modeFooter);

        const sync = () => {
          markComposer(root);
          topic.textContent = topicLabel(root);
          mode.textContent = modeLabel(root);
          const attachment = root.querySelector('[data-mc-role="attachments"]');
          const attachmentCount =
            attachment?.querySelectorAll('button[aria-label^="Remove "]').length ?? 0;
          add.textContent = attachmentCount ? `Add · ${attachmentCount}` : "Add";

          const draftCard = root.querySelector(
            '[data-mc-role="aside"] section:nth-child(2)'
          );
          const status = draftCard?.querySelector("p")?.textContent?.trim() ?? "";
          draft.textContent = status.toLowerCase().includes("saving")
            ? "Saving…"
            : status.toLowerCase().includes("local")
              ? "Local"
              : "✓ Saved";

          if (
            panel === "topic" &&
            !root.querySelector('[data-mc-role="topic"] .absolute')
          ) {
            window.setTimeout(closePanel, 80);
          }
        };

        const handleActivity = (event: Event) => {
          const target = event.target as Element | null;
          const clicked = target?.closest("button");
          if (
            clicked?.closest('[data-mc-role="mode"]') &&
            ["Open Discussion", "Debate", "Research Question", "Problem Solving"].some(
              (label) => starts(clicked, label)
            )
          ) {
            window.setTimeout(closePanel, 0);
          }
          window.setTimeout(sync, 0);
        };

        root.addEventListener("click", handleActivity, true);
        root.addEventListener("input", handleActivity, true);
        root.addEventListener("change", handleActivity, true);
        const statusTimer = window.setInterval(sync, 1200);
        sync();

        teardown = () => {
          cancelled = true;
          window.clearTimeout(locateTimer);
          window.clearInterval(statusTimer);
          root.removeEventListener("click", handleActivity, true);
          root.removeEventListener("input", handleActivity, true);
          root.removeEventListener("change", handleActivity, true);
          delete root.dataset.mobileCreate;
          delete root.dataset.mcPanel;
          delete root.dataset.mcAdvanced;
          delete document.body.dataset.createFocus;
          for (const element of Array.from(
            root.querySelectorAll<HTMLElement>("[data-mc-role]")
          )) {
            delete element.dataset.mcRole;
          }
          for (const element of [
            style,
            header,
            context,
            footer,
            overlay,
            sheetHeader,
            moreSheet,
            modeFooter,
          ]) {
            element.remove();
          }
          document.body.style.overflow = "";
        };
      };

      locate();
      teardown = () => {
        cancelled = true;
        window.clearTimeout(locateTimer);
      };
    };

    activate();
    media.addEventListener("change", activate);
    return () => {
      media.removeEventListener("change", activate);
      teardown?.();
    };
  }, []);

  return null;
}
