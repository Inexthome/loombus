import StickiesV2Client from "./stickies-v2-client";
import "./stickies-editorial.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function StickiesPage() {
  return (
    <div data-loombus-stickies-editorial>
      <StickiesV2Client />
    </div>
  );
}
