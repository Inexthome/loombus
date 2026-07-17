"use client";

import { TasksView } from "@/components/room-expansion-view-tasks";
import { PollsView } from "@/components/room-expansion-view-polls";
import { FormsView } from "@/components/room-expansion-view-forms";
import { KnowledgeView } from "@/components/room-expansion-view-knowledge";
import { CalendarView } from "@/components/room-expansion-view-calendar";
import { FilesView } from "@/components/room-expansion-view-files";
import { OrganizationView } from "@/components/room-expansion-view-organization";

export function ExpansionBody(props) {
  if (props.view === "tasks") return <TasksView {...props} />;
  if (props.view === "polls") return <PollsView {...props} />;
  if (props.view === "forms") return <FormsView {...props} />;
  if (props.view === "knowledge") return <KnowledgeView {...props} />;
  if (props.view === "calendar") return <CalendarView {...props} />;
  if (props.view === "files") return <FilesView {...props} />;
  if (props.view === "organization") return <OrganizationView {...props} />;
  return null;
}
