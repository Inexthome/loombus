import StickiesV2Client from "./stickies-v2-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function StickiesPage() {
  return <StickiesV2Client />;
}
