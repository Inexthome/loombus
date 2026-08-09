import LegalRetentionClient from "./legal-retention-client";

export const metadata = {
  title: "Legal Retention | Loombus Admin",
  robots: { index: false, follow: false },
};

export default function LegalRetentionPage() {
  return <LegalRetentionClient />;
}
