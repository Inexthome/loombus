import MyActivityV2Client from "./my-activity-v2-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MyActivityPage() {
  return <MyActivityV2Client />;
}
