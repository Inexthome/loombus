import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PlatformOperationsClient, {
  type PlatformModule,
} from "../platform-operations-client";

export const metadata: Metadata = {
  title: "Platform Module | Loombus Admin",
  description:
    "Role-protected operational review for Loombus platform modules.",
  robots: {
    index: false,
    follow: false,
  },
};

const MODULES = new Set<PlatformModule>([
  "marketplace",
  "businesses",
  "jobs",
  "events",
  "requests",
  "services",
  "rooms",
  "appointments",
  "local",
  "matches",
]);

type Props = {
  params: Promise<{
    module: string;
  }>;
};

export default async function PlatformModulePage({ params }: Props) {
  const { module } = await params;

  if (!MODULES.has(module as PlatformModule)) {
    notFound();
  }

  return (
    <PlatformOperationsClient
      initialModule={module as PlatformModule}
    />
  );
}
