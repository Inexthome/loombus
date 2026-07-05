import Link from "next/link";

export default async function V2RoomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  return (
    <>
      {children}
      <Link
        href={`/rooms/${roomId}/requests`}
        className="fixed bottom-24 right-5 z-[120] inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg ring-1 ring-white/20 transition hover:bg-slate-800 sm:bottom-8"
      >
        Open Request Center
      </Link>
    </>
  );
}
