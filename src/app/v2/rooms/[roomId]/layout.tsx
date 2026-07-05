import { RoomRequestSummary } from "./room-request-summary";
import { RoomRequestsSectionActivator } from "./room-requests-section-activator";
import { RoomResourceSummary } from "./room-resource-summary";
import { RoomResourcesSectionActivator } from "./room-resources-section-activator";

export default async function V2RoomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  return (
    <>
      {children}
      <RoomRequestSummary roomId={roomId} />
      <RoomResourceSummary roomId={roomId} />
      <RoomRequestsSectionActivator roomId={roomId} />
      <RoomResourcesSectionActivator roomId={roomId} />
    </>
  );
}
