import { ContributorTrustGuide } from "@/components/contributor-trust-guide";

export default function PeopleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <ContributorTrustGuide />
    </>
  );
}
