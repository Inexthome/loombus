import type { Metadata } from "next";
import { getPublicPolicyDiscoveryEntries } from "@/lib/policy-content-public-discovery";
import PolicyHelpDiscoveryClient from "./policy-help-discovery-client";
import SupportV2Client from "./support-v2-client";
import "./support-v2.css";
import "./policy-help-discovery.css";

export const metadata: Metadata = {
  title: "Help & Support | Loombus",
  description:
    "Contact Loombus Support for account, billing, safety, accessibility, or technical help and search current public policy documents.",
  alternates: {
    canonical: "https://loombus.com/support",
  },
};

export default function SupportPage() {
  const policyEntries = getPublicPolicyDiscoveryEntries();

  return (
    <>
      <PolicyHelpDiscoveryClient policyEntries={policyEntries} />
      <div className="support-policy-contact-only">
        <SupportV2Client />
      </div>
    </>
  );
}
