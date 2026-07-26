import type { Metadata } from "next";
import RoomEnterpriseClient from "./room-enterprise-client";
import "./room-enterprise.css";

export const metadata: Metadata = {
  title: "Organization Enterprise | Loombus Rooms",
  description:
    "Contact Loombus about a custom Organization Enterprise agreement for private Rooms, capacity, controls, onboarding, and support.",
  robots: { index: false, follow: false },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function RoomEnterprisePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <RoomEnterpriseClient
      initialOrganization={first(params.organization)}
      initialUseCase={first(params.useCase)}
      initialModel={first(params.model)}
      roomId={first(params.roomId)}
      currentPlan={first(params.currentPlan)}
    />
  );
}
