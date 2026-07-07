import { RoomActivitySummary } from "./room-activity-summary";
import { RoomActivitySectionActivator } from "./room-activity-section-activator";
import { RoomDirectorySummary } from "./room-directory-summary";
import { RoomDirectorySectionActivator } from "./room-directory-section-activator";
import { RoomDocumentsSummary } from "./room-documents-summary";
import { RoomDocumentsSectionActivator } from "./room-documents-section-activator";
import { RoomEntrySummary } from "./room-entry-summary";
import { RoomEntrySectionActivator } from "./room-entry-section-activator";
import { RoomFaqSummary } from "./room-faq-summary";
import { RoomFaqSectionActivator } from "./room-faq-section-activator";
import { RoomFormsSummary } from "./room-forms-summary";
import { RoomFormsSectionActivator } from "./room-forms-section-activator";
import { RoomMembersSummary } from "./room-members-summary";
import { RoomMembersSectionActivator } from "./room-members-section-activator";
import { RoomModuleDirectorySectionActivator } from "./room-module-directory-section-activator";
import { RoomPlanMenu } from "./room-plan-menu";
import { RoomPollsSummary } from "./room-polls-summary";
import { RoomPollsSectionActivator } from "./room-polls-section-activator";
import { RoomPreferencesEnforcer } from "./room-preferences-enforcer";
import { RoomRequestSummary } from "./room-request-summary";
import { RoomRequestsSectionActivator } from "./room-requests-section-activator";
import { RoomResourceSummary } from "./room-resource-summary";
import { RoomResourcesSectionActivator } from "./room-resources-section-activator";
import { RoomServicesSummary } from "./room-services-summary";
import { RoomServicesSectionActivator } from "./room-services-section-activator";
import { RoomTasksSummary } from "./room-tasks-summary";
import { RoomTasksSectionActivator } from "./room-tasks-section-activator";

export default async function V2RoomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  return (
    <>
      {children}
      <RoomPlanMenu roomId={roomId} />
      <RoomPreferencesEnforcer roomId={roomId} />
      <RoomMembersSummary roomId={roomId} />
      <RoomEntrySummary roomId={roomId} />
      <RoomActivitySummary roomId={roomId} />
      <RoomTasksSummary roomId={roomId} />
      <RoomPollsSummary roomId={roomId} />
      <RoomDirectorySummary roomId={roomId} />
      <RoomFaqSummary roomId={roomId} />
      <RoomDocumentsSummary roomId={roomId} />
      <RoomFormsSummary roomId={roomId} />
      <RoomRequestSummary roomId={roomId} />
      <RoomResourceSummary roomId={roomId} />
      <RoomServicesSummary roomId={roomId} />
      <RoomModuleDirectorySectionActivator roomId={roomId} />
      <RoomMembersSectionActivator roomId={roomId} />
      <RoomEntrySectionActivator roomId={roomId} />
      <RoomActivitySectionActivator roomId={roomId} />
      <RoomTasksSectionActivator roomId={roomId} />
      <RoomPollsSectionActivator roomId={roomId} />
      <RoomDirectorySectionActivator roomId={roomId} />
      <RoomFaqSectionActivator roomId={roomId} />
      <RoomDocumentsSectionActivator roomId={roomId} />
      <RoomFormsSectionActivator roomId={roomId} />
      <RoomRequestsSectionActivator roomId={roomId} />
      <RoomResourcesSectionActivator roomId={roomId} />
      <RoomServicesSectionActivator roomId={roomId} />
    </>
  );
}
