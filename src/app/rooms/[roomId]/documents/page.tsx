import type { Metadata } from "next";
import RoomDocumentsClient from "./room-documents-client";

export const metadata: Metadata = {
  title: "Room Documents",
  description: "Private Room document and knowledge library.",
  robots: { index: false, follow: false },
};

export default function RoomDocumentsPage() {
  return <RoomDocumentsClient />;
}
