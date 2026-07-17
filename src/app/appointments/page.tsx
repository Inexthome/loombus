import type { Metadata } from "next";
import AppointmentsManagerPage from "@/components/appointments-manager-page";

export const metadata: Metadata = {
  title: "Appointments",
  description: "Manage business appointment services and appointment requests on Loombus.",
  robots: { index: false, follow: false },
};

export default function AppointmentsPage() {
  return <AppointmentsManagerPage />;
}
