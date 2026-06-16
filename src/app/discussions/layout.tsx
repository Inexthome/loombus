import { DiscoverySignalGuide } from "@/components/discovery-signal-guide";

export default function DiscussionsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <DiscoverySignalGuide />
    </>
  );
}
