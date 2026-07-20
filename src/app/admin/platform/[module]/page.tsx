import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ADMIN_PLATFORM_MODULES,
  type PlatformModuleKey,
} from "../admin-platform-registry";
import PlatformModuleClient from "../platform-module-client";

export const metadata: Metadata = {
  title: "Platform Module | Loombus Admin",
  description:
    "Role-protected operational review for one active Loombus platform module.",
  robots: {
    index: false,
    follow: false,
  },
};

const MODULES = new Set<PlatformModuleKey>(
  ADMIN_PLATFORM_MODULES.map((module) => module.key),
);

type Props = {
  params: Promise<{
    module: string;
  }>;
};

export default async function PlatformModulePage({ params }: Props) {
  const { module } = await params;

  if (!MODULES.has(module as PlatformModuleKey)) {
    notFound();
  }

  return <PlatformModuleClient moduleKey={module as PlatformModuleKey} />;
}
