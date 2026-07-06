import { RoomActivitySummary } from "./room-activity-summary";
import { RoomActivitySectionActivator } from "./room-activity-section-activator";
import { RoomEntrySummary } from "./room-entry-summary";
import { RoomEntrySectionActivator } from "./room-entry-section-activator";
import { RoomMembersSummary } from "./room-members-summary";
import { RoomMembersSectionActivator } from "./room-members-section-activator";
import { RoomPreferencesEnforcer } from "./room-preferences-enforcer";
import { RoomRequestSummary } from "./room-request-summary";
import { RoomRequestsSectionActivator } from "./room-requests-section-activator";
import { RoomResourceSummary } from "./room-resource-summary";
import { RoomResourcesSectionActivator } from "./room-resources-section-activator";
import { RoomServicesSummary } from "./room-services-summary";
import { RoomServicesSectionActivator } from "./room-services-section-activator";

export default async function V2RoomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  return (
    <>
      {children}
      <RoomPreferencesEnforcer roomId={roomId} />
      <RoomMembersSummary roomId={roomId} />
      <RoomEntrySummary roomId={roomId} />
      <RoomActivitySummary roomId={roomId} />
      <RoomRequestSummary roomId={roomId} />
      <RoomResourceSummary roomId={roomId} />
      <RoomServicesSummary roomId={roomId} />
      <RoomMembersSectionActivator roomId={roomId} />
      <RoomEntrySectionActivator roomId={roomId} />
      <RoomActivitySectionActivator roomId={roomId} />
      <RoomRequestsSectionActivator roomId={roomId} />
      <RoomResourcesSectionActivator roomId={roomId} />
      <RoomServicesSectionActivator roomId={roomId} />
    </>
  );
}
