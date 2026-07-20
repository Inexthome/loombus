import type { Metadata } from "next";
import {
  BadgeAlert,
  Banknote,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import CommerceSafetyPage from "@/components/commerce-safety-page";

export const metadata: Metadata = {
  title: "Requests Safety",
  description: "Safety and accountability guidance for using Loombus Requests.",
  alternates: { canonical: "https://loombus.com/requests/safety" },
};

const SAFETY_CARDS = [
  {
    Icon: UserCheck,
    title: "Verify the person or business",
    body: "Review the attributable profile, ask for relevant credentials, and independently confirm licenses or insurance when the work requires them.",
  },
  {
    Icon: Banknote,
    title: "Keep payment terms explicit",
    body: "Loombus does not process request payments or escrow funds. Confirm the price, deposit, cancellation terms, and deliverables in writing.",
  },
  {
    Icon: ShieldCheck,
    title: "Protect private information",
    body: "Do not post sensitive addresses, identification numbers, account details, medical records, or access codes in a public Request.",
  },
  {
    Icon: BadgeAlert,
    title: "Report suspicious activity",
    body: "Report fraud, harassment, prohibited activity, misleading claims, or pressure to move into unsafe communication or payment channels.",
  },
];

export default function RequestsSafetyPage() {
  return (
    <CommerceSafetyPage
      eyebrow="Requests safety"
      title="A Request starts a connection. It is not a guarantee."
      intro="Loombus keeps requesters and responders attributable, but members remain responsible for checking identity, qualifications, scope, pricing, location, and safety before meeting or paying anyone."
      cards={SAFETY_CARDS}
      prohibitedTitle="Requests that are not allowed"
      prohibitedBody="Requests may not be used for illegal services, regulated weapons, controlled substances, exploitation, harassment, discriminatory exclusions, identity fraud, financial scams, or attempts to bypass Loombus safety controls. Private Room Request Centers should be used for needs that must stay inside an organization or community."
      boundaryTitle="Connection does not equal verification"
      boundaryBody="Members remain responsible for checking identity, qualifications, scope, pricing, location, and safety before meeting or paying anyone."
      primaryAction={{ href: "/requests", label: "Browse Requests" }}
      secondaryAction={{ href: "/requests/manage", label: "Manage Requests" }}
    />
  );
}
