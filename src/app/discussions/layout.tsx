import "./discussion-feed-media.css";

export default function DiscussionsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="discussion-feed-route">{children}</div>;
}
