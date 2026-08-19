import type { ReactNode } from "react";
import "./payment-operations-light.css";

export default function ProfessionalBookingPaymentsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="professional-booking-payment-operations-scope">
      {children}
    </div>
  );
}
