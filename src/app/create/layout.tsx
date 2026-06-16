import { CreateSignalGuide } from "@/components/create-signal-guide";

export default function CreateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <CreateSignalGuide />
    </>
  );
}
