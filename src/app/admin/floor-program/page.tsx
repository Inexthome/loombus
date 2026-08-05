import type { Metadata } from "next";
import AdminFloorProgramClient from "@/components/admin-floor-program-client";

export const metadata: Metadata = {
  title: "The Floor Operations Desk | Loombus Admin",
  description: "Administrator operations for The Floor programming, reviewed research, and contributor assignments.",
  robots: { index: false, follow: false },
};

export default function AdminFloorProgramPage(){return <AdminFloorProgramClient/>;}
