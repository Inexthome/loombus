import type { Metadata } from "next";
import {
  AlertTriangle,
  BadgeCheck,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import CommerceSafetyPage from "@/components/commerce-safety-page";

export const metadata: Metadata = {
  title: "Marketplace Safety and Policy | Loombus",
  description:
    "Review Loombus Marketplace listing rules, transaction boundaries, reporting, and safer exchange practices.",
};

const prohibited = [
  "Weapons, ammunition, explosives, and restricted self-defense items",
  "Illegal or recreational drugs, alcohol, nicotine, tobacco, and prescription medication",
  "Counterfeit goods, stolen property, wildlife contraband, and hazardous materials",
  "Adult products, pornography, and regulated gambling items",
];

const SAFETY_CARDS = [
  {
    Icon: BadgeCheck,
    title: "Confirm the seller and item",
    body: "Confirm the seller identity, item condition, total price, and delivery terms before agreeing.",
  },
  {
    Icon: ShieldCheck,
    title: "Use a safer meeting location",
    body: "Meet in a visible public location when local pickup is appropriate. Do not enter an unfamiliar private location alone.",
  },
  {
    Icon: WalletCards,
    title: "Protect account information",
    body: "Do not send passwords, verification codes, government identification numbers, or banking credentials.",
  },
  {
    Icon: AlertTriangle,
    title: "Stop when details change",
    body: "Stop the transaction and report the listing when the item, seller, or payment request changes unexpectedly.",
  },
];

export default function MarketplaceSafetyPage() {
  return (
    <CommerceSafetyPage
      eyebrow="Marketplace trust"
      title="Safety, accountability, and transaction boundaries"
      intro="Loombus provides attributable listings, moderation, reporting, saved-item status, and profile-based communication. Loombus does not process Marketplace payments, hold funds, provide escrow, arrange shipping, inspect items, or guarantee a transaction."
      cards={SAFETY_CARDS}
      prohibitedTitle="Listings that are not allowed"
      prohibitedItems={prohibited}
      boundaryTitle="Payment and dispute boundary"
      boundaryBody="Any payment, refund, delivery, return, warranty, or dispute occurs directly between the buyer and seller. A Loombus profile, business verification badge, listing approval, or Signal placement is not a transaction guarantee. Never treat an off-platform payment request as endorsed by Loombus."
      primaryAction={{ href: "/marketplace", label: "Return to Marketplace" }}
      secondaryAction={{ href: "/marketplace/manage", label: "Manage Marketplace" }}
    />
  );
}
