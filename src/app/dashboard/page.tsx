import DashboardCompactClient from "./dashboard-compact-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardPage() {
  return <DashboardCompactClient />;
}
