import { MyActivityInsightsEntry } from "@/components/my-activity-insights-entry";
import MyActivityV2Client from "./my-activity-v2-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MyActivityPage() {
  return (
    <>
      <MyActivityInsightsEntry />
      <MyActivityV2Client />
    </>
  );
}
