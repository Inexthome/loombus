"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TooltipDefinition = {
  label: string;
  description: string;
};

const CREATE_TOOLTIPS: TooltipDefinition[] = [
  {
    label: "Discussion Purpose",
    description: "Briefly states what you want this discussion to explore, clarify, or accomplish.",
  },
  {
    label: "Debate Goal",
    description: "States the question, claim, or disagreement the debate should examine.",
  },
  {
    label: "Research Goal",
    description: "Defines what the research discussion is trying to investigate, understand, or establish.",
  },
  {
    label: "Desired Outcome",
    description: "Describes the result or solution you want the problem-solving discussion to work toward.",
  },
  {
    label: "Tags",
    description: "Adds a few specific terms that help describe and organize the discussion beyond its main topic.",
  },
];

function normalize(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function findDefinition(text: string | null | undefined) {
  const candidate = normalize(text);
  return CREATE_TOOLTIPS.find(({ label }) => {
    const target = normalize(label);
    return candidate === target || candidate.startsWith(`${target} `);
  });
}

function InfoTooltip({ definition }: { definition: TooltipDefinition }) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="create-info-tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="create-info-tooltip__trigger"
        aria-label={`More information about ${definition.label}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        i
      </button>
      {open ? (
        <span id={id} role="tooltip" className="create-info-tooltip__bubble">
          {definition.description}
        </span>
      ) : null}
    </span>
  );
}

export function CreateInfoTooltips() {
  const [targets, setTargets] = useState<Array<{ element: HTMLElement; definition: TooltipDefinition }>>([]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-create-composer-variant]");
    if (!root) return;

    const discover = () => {
      const elements = Array.from(root.querySelectorAll<HTMLElement>(".create-field-label"));
      const next: Array<{ element: HTMLElement; definition: TooltipDefinition }> = [];

      for (const element of elements) {
        if (element.dataset.infoTooltipHost === "true") continue;
        const definition = findDefinition(element.textContent);
        if (!definition) continue;
        element.dataset.infoTooltipHost = "true";
        next.push({ element, definition });
      }

      if (next.length) setTargets((current) => [...current, ...next]);
    };

    discover();
    const observer = new MutationObserver(discover);
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      {targets.map(({ element, definition }) =>
        createPortal(<InfoTooltip definition={definition} />, element, `${definition.label}-${definition.description}`)
      )}
    </>
  );
}
