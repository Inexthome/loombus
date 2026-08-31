import "./dashboard-compact.css";
import "./dashboard-loombus-background.css";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
