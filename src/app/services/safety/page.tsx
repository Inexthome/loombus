import type { Metadata } from "next";
import {
  BadgeAlert,
  Banknote,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import CommerceSafetyPage from "@/components/commerce-safety-page";

export const metadata: Metadata = {
  title: "Services Safety",
  description:
    "Safety and accountability guidance for using Loombus Services.",
  alternates: { canonical: "https://loombus.com/services/safety" },
};

const SAFETY_CARDS = [
  {
    Icon: UserCheck,
    title: "Verify the provider",
    body: "Review the attributable profile and independently confirm licenses, insurance, credentials, references, and experience when the work requires them.",
  },
  {
    Icon: Banknote,
    title: "Confirm scope and payment terms",
    body: "Loombus does not process payments or hold escrow. Confirm deliverables, price, deposits, cancellation terms, and change orders in writing.",
  },
  {
    Icon: ShieldCheck,
    title: "Protect private information",
    body: "Do not post addresses, access codes, identification numbers, financial details, or sensitive records in a public inquiry or Service listing.",
  },
  {
    Icon: BadgeAlert,
    title: "Report suspicious listings",
    body: "Report fraud, misleading claims, prohibited activity, harassment, discrimination, or pressure to use unsafe communication or payment channels.",
  },
];

export default function ServicesSafetyPage() {
  return (
    <CommerceSafetyPage
      eyebrow="Services safety"
      title="A published Service is attributable. It is not guaranteed."
      intro="Loombus connects providers and customers through structured inquiries, Requests, conversations, and Appointments. Members remain responsible for verifying qualifications, terms, safety, and payment."
      cards={SAFETY_CARDS}
      prohibitedTitle="Services that are not allowed"
      prohibitedBody="Services may not be used for illegal activity, regulated weapons, controlled substances, exploitation, harassment, discriminatory exclusions, identity fraud, financial scams, false credential claims, or attempts to bypass Loombus safety controls."
      boundaryTitle="Responsibility remains with the members"
      boundaryBody="Members remain responsible for verifying qualifications, terms, safety, and payment before work begins."
      primaryAction={{ href: "/services", label: "Browse Services" }}
      secondaryAction={{ href: "/services/manage", label: "Manage Services" }}
    />
  );
}
