import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ADMIN_PLATFORM_MODULES,
  type AdminPlatformModuleKey,
  type PlatformModuleKey,
} from "../admin-platform-registry";
import DuplicateReviewClient from "../duplicate-review-client";
import PlatformModuleClient from "../platform-module-client";
import SearchOperationsClient from "../search-operations-client";

export const metadata: Metadata = {
  title: "Platform Module | Loombus Admin",
  description:
    "Role-protected operational review for one active Loombus platform module.",
  robots: {
    index: false,
    follow: false,
  },
};

const MODULES = new Set<AdminPlatformModuleKey>(
  ADMIN_PLATFORM_MODULES.map((module) => module.key),
);

type Props = {
  params: Promise<{
    module: string;
  }>;
};

export default async function PlatformModulePage({ params }: Props) {
  const { module } = await params;

  if (!MODULES.has(module as AdminPlatformModuleKey)) {
    notFound();
  }

  if (module === "duplicates") {
    return <DuplicateReviewClient />;
  }

  if (module === "search") {
    return <SearchOperationsClient />;
  }

  return <PlatformModuleClient moduleKey={module as PlatformModuleKey} />;
}
