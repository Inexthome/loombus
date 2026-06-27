"use client";

import { useParams } from "next/navigation";
import { V2GapShellPage } from "../../v2-gap-shell-page";

function getParamValue(param: string | string[] | undefined) {
  return (Array.isArray(param) ? param[0] : param ?? "").trim();
}

export default function V2SecondaryDetailPage() {
  const params = useParams<{ section?: string | string[]; item?: string | string[] }>();
  const sectionKey = getParamValue(params?.section);
  const itemSlug = getParamValue(params?.item);

  return <V2GapShellPage sectionKey={sectionKey} itemSlug={itemSlug} />;
}
