import "server-only";

export type LoombusEmailChannel =
  | "product"
  | "digest"
  | "notifications"
  | "billing"
  | "security"
  | "no-reply";

export type LoombusEmailIdentity = {
  from: string;
  replyTo?: string;
};

const DEFAULTS: Record<LoombusEmailChannel, LoombusEmailIdentity> = {
  product: {
    from: "Loombus <hello@mail.loombus.com>",
    replyTo: "service@loombus.com",
  },
  digest: {
    from: "Loombus <hello@mail.loombus.com>",
    replyTo: "service@loombus.com",
  },
  notifications: {
    from: "Loombus Notifications <notifications@mail.loombus.com>",
    replyTo: "support@loombus.com",
  },
  billing: {
    from: "Loombus Billing <billing@mail.loombus.com>",
    replyTo: "billing@loombus.com",
  },
  security: {
    from: "Loombus Security <security@mail.loombus.com>",
    replyTo: "security@loombus.com",
  },
  "no-reply": {
    from: "Loombus <no-reply@mail.loombus.com>",
  },
};

function mailbox(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const bracketed = trimmed.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/);
  return (bracketed?.[1] ?? trimmed).toLowerCase();
}

export function isAuthorizedLoombusSystemSender(value: string | undefined) {
  const address = mailbox(value);
  return Boolean(address?.endsWith("@mail.loombus.com"));
}

function verifiedOverride(value: string | undefined, fallback: string) {
  if (!value?.trim()) return fallback;
  if (isAuthorizedLoombusSystemSender(value)) return value.trim();
  console.warn(
    `Ignoring outbound sender outside verified mail.loombus.com domain: ${value}`
  );
  return fallback;
}

function configuredFrom(channel: LoombusEmailChannel) {
  switch (channel) {
    case "product":
      return process.env.PRODUCT_FROM_EMAIL || process.env.DIGEST_FROM_EMAIL;
    case "digest":
      return process.env.DIGEST_FROM_EMAIL || process.env.PRODUCT_FROM_EMAIL;
    case "notifications":
      return process.env.NOTIFICATIONS_FROM_EMAIL;
    case "billing":
      return process.env.BILLING_FROM_EMAIL;
    case "security":
      return process.env.SECURITY_FROM_EMAIL;
    case "no-reply":
      return process.env.NO_REPLY_FROM_EMAIL;
  }
}

export function getLoombusEmailIdentity(
  channel: LoombusEmailChannel
): LoombusEmailIdentity {
  const fallback = DEFAULTS[channel];
  return {
    ...fallback,
    from: verifiedOverride(configuredFrom(channel), fallback.from),
  };
}
