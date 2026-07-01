import type { ReactNode } from "react";
import { AdminV2Shell } from "@/components/admin/admin-v2-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminV2Shell>{children}</AdminV2Shell>;
}
