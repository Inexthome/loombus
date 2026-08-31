import "./messages-v2.css";
import "./messages-editorial.css";

export default function MessagesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div data-loombus-messages-editorial>{children}</div>;
}
