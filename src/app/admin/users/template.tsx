"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";

export default function AdminUsersTemplate({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAdminAccess() {
      const { data: userData } = await supabase.auth.getUser();

      if (!active) return;

      if (!userData.user) {
        window.location.replace("/login?next=/admin/users");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!active) return;

      if (!profile?.is_admin) {
        window.location.replace("/discussions?admin=denied");
        return;
      }

      setAllowed(true);
    }

    checkAdminAccess();

    return () => {
      active = false;
    };
  }, []);

  if (!allowed) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-500">
          Checking admin access...
        </div>
      </main>
    );
  }

  return children;
}
