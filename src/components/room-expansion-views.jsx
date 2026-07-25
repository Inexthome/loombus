"use client";

import { TasksView } from "@/components/room-expansion-view-tasks";
import { PollsView } from "@/components/room-expansion-view-polls";
import { FormsView } from "@/components/room-expansion-view-forms";
import { KnowledgeView } from "@/components/room-expansion-view-knowledge";
import { CalendarView } from "@/components/room-expansion-view-calendar";
import { FilesView } from "@/components/room-expansion-view-files";
import { OrganizationView } from "@/components/room-expansion-view-organization";
import { StudioPagination } from "@/components/room-expansion-ui";

const PAGED_VIEWS = new Set(["tasks", "polls", "forms", "knowledge", "files"]);
const ITEM_LABELS = {
  tasks: "tasks",
  polls: "decisions",
  forms: "forms",
  knowledge: "articles",
  files: "files",
};

export function ExpansionBody(props) {
  const paged = PAGED_VIEWS.has(props.view);
  const viewData =
    paged && props.view !== "files" && Array.isArray(props.data?.items)
      ? props.data.items
      : props.data;
  const childProps = { ...props, data: viewData };
  let body = null;

  if (props.view === "tasks") body = <TasksView {...childProps} />;
  else if (props.view === "polls") body = <PollsView {...childProps} />;
  else if (props.view === "forms") body = <FormsView {...childProps} />;
  else if (props.view === "knowledge") body = <KnowledgeView {...childProps} />;
  else if (props.view === "calendar") body = <CalendarView {...childProps} />;
  else if (props.view === "files") body = <FilesView {...childProps} />;
  else if (props.view === "organization") {
    body = <OrganizationView {...childProps} />;
  }

  if (!body) return null;
  return (
    <>
      {props.data?.limits?.relatedRowsTruncated ? (
        <p className="room-expansion-limit-warning" role="status">
          This page reached its related-record safety limit. Only the bounded
          set already loaded is shown; no unbounded Room dataset was returned.
        </p>
      ) : null}
      {body}
      {paged ? (
        <StudioPagination
          pageInfo={props.data?.pageInfo}
          loading={props.loading || props.working}
          onPageChange={props.onPageChange}
          itemLabel={ITEM_LABELS[props.view] || "items"}
        />
      ) : null}
    </>
  );
}
