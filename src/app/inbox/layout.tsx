import "./inbox.css";
import "../messages/messages-v2.css";

export default function InboxLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
