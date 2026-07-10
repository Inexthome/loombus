import Link from "next/link";

const toolCopy: Record<string, { title: string; body: string }> = {
  overview: { title: "Overview", body: "Room summary, plan status, recent activity, and next steps." },
  discussions: { title: "Discussions", body: "Private room posts and member conversations." },
  calendar: { title: "Calendar", body: "Events, meetings, maintenance windows, and room dates." },
  announcements: { title: "Announcements", body: "Pinned owner updates and important notices." },
  requests: { title: "Requests", body: "Maintenance, help, support, and general room requests." },
  resources: { title: "Resources", body: "Documents, links, rules, forms, and guides." },
  services: { title: "Services / Store", body: "Room-specific listings, booking, services, and offers." },
  members: { title: "Members / Roles", body: "Roles, invites, access approvals, and member controls." },
  tasks: { title: "Tasks", body: "Action items, owner follow-ups, and room work tracking." },
  polls: { title: "Polls / Decisions", body: "Member votes, decisions, and consensus tracking." },
  faq: { title: "FAQ", body: "Reusable room knowledge base articles." },
  files: { title: "Files", body: "Shared documents and file hub access." },
  documents: { title: "Documents", body: "Rules, guides, forms, PDFs, meeting notes, and shared files." },
  forms: { title: "Forms", body: "Structured room forms and member submissions." },
  directory: { title: "Directory", body: "Room contacts, vendors, residents, staff, and useful entries." },
  settings: { title: "Settings", body: "Privacy, room details, permissions, and setup controls." },
};

export default async function RoomToolPage({ params }: { params: Promise<{ roomId: string; roomTool: string }> }) {
  const { roomId, roomTool } = await params;
  const tool = toolCopy[roomTool] ?? { title: roomTool.replace(/-/g, " "), body: "Room module." };

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <Link href={`/rooms/${encodeURIComponent(roomId)}`} className="mb-4 inline-flex rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]">
          ← Back to room hub
        </Link>

        <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">Private room module</p>
          <h1 className="mt-3 text-4xl font-black capitalize tracking-tight sm:text-5xl">{tool.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">{tool.body}</p>
          <p className="mt-6 rounded-2xl bg-[var(--loombus-surface-muted)] p-4 text-sm font-semibold text-[var(--loombus-text-muted)]">
            This canonical module route is restored under the current Loombus appearance system. The deeper live controls for this module can now be wired back one module at a time without depending on `/v2` routes.
          </p>
        </section>
      </section>
    </main>
  );
}
