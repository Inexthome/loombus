import "./discussion-detail-v2.css";

export default function DiscussionDetailLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="discussion-detail-canonical">{children}</div>;
}
