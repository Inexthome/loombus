import { ReplySignalGuide } from "@/components/reply-signal-guide";

export default function DiscussionDetailLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <ReplySignalGuide />
    </>
  );
}
