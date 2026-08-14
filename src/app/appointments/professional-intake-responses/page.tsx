import type { Metadata } from "next";
import ProfessionalBookingIntakeResponsesPage from "@/components/professional-booking-intake-responses-page";

export const metadata: Metadata = {
  title: "Client Intake Responses",
  description:
    "Review Professional Booking client intake responses attached to appointment requests.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ProfessionalBookingIntakeResponsesPage />;
}
