import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import {
  PublicPolicyPage,
  type PublicPolicySection,
} from "@/components/public-policy-page";
import {
  isSafePolicyPayloadHref,
  type PolicyPayloadInline,
  type StructuredPolicyPayload,
} from "@/lib/policy-content-payload";

const linkClassName =
  "underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--loombus-bg)]";

function renderInline(
  inline: PolicyPayloadInline,
  key: string,
): ReactNode {
  if (inline.type === "text") {
    return <Fragment key={key}>{inline.text}</Fragment>;
  }

  if (!isSafePolicyPayloadHref(inline.href)) {
    return <Fragment key={key}>{inline.text}</Fragment>;
  }

  if (inline.href.startsWith("/")) {
    return (
      <Link key={key} href={inline.href} className={linkClassName}>
        {inline.text}
      </Link>
    );
  }

  return (
    <a key={key} href={inline.href} className={linkClassName} rel="noreferrer">
      {inline.text}
    </a>
  );
}

function toPublicPolicySection(
  section: StructuredPolicyPayload["sections"][number],
): PublicPolicySection {
  const paragraphs: ReactNode[] = [];
  const bullets: ReactNode[] = [];

  // PublicPolicyPage currently renders all paragraph content before its bullet list.
  // Preserve that established presentation during migration even if the source JSON
  // stores blocks in legacy object-field order. A future payload schema can add an
  // explicitly ordered renderer only through a reviewed schema-version change.
  for (const [blockIndex, block] of section.blocks.entries()) {
    if (block.type === "paragraph") {
      paragraphs.push(
        <Fragment key={`${section.id}-paragraph-${blockIndex}`}>
          {block.content.map((inline, inlineIndex) =>
            renderInline(
              inline,
              `${section.id}-paragraph-${blockIndex}-inline-${inlineIndex}`,
            ),
          )}
        </Fragment>,
      );
      continue;
    }

    for (const [itemIndex, item] of block.items.entries()) {
      bullets.push(
        <Fragment key={`${section.id}-bullet-${blockIndex}-${itemIndex}`}>
          {item}
        </Fragment>,
      );
    }
  }

  return {
    id: section.id,
    title: section.title,
    paragraphs: paragraphs.length > 0 ? paragraphs : undefined,
    bullets: bullets.length > 0 ? bullets : undefined,
  };
}

export function StructuredPolicyRenderer({
  payload,
}: {
  payload: StructuredPolicyPayload;
}) {
  return (
    <PublicPolicyPage
      eyebrow={payload.eyebrow}
      title={payload.title}
      description={payload.description}
      sections={payload.sections.map(toPublicPolicySection)}
      effectiveDate={payload.effectiveDate ?? undefined}
      reviewedDate={payload.reviewedDate ?? undefined}
    />
  );
}
