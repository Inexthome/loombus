import TopicsV2Client from "./topics-v2-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TopicsPage() {
  return <TopicsV2Client />;
}
