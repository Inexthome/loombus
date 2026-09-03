"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AttentionNotification = {
  id: string;
  target_type: string;
  target_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
};

type AttentionItemLink = {
  id: string;
  action_url: string;
};

const LEGACY_DESTINATIONS: Record<string, (id: string) => string> = {
  admin_report: (id) => `/admin/reports?report=${encodeURIComponent(id)}`,
  admin_support_request: (id) => `/admin/support?request=${encodeURIComponent(id)}`,
  admin_labs_request: (id) => `/admin/labs?request=${encodeURIComponent(id)}`,
  admin_library_review: (id) => `/admin/library-review?publication=${encodeURIComponent(id)}`,
  admin_booking_dispute: (id) => `/admin/professional-booking/payments?dispute=${encodeURIComponent(id)}`,
  admin_identity_review: (id) => `/admin/users?member=${encodeURIComponent(id)}`,
  admin_account_deletion: (id) => `/admin/legal-operations?deletion_request=${encodeURIComponent(id)}`,
  admin_trust_safety_case: (id) => `/admin/legal-operations?trust_safety_case=${encodeURIComponent(id)}`,
};

export function getLegacyAdminAttentionNotificationHref(targetType: string, targetId: string | null) {
  if (!targetId) return null;
  return LEGACY_DESTINATIONS[targetType]?.(targetId) ?? null;
}

export default function AdminAttentionNotifications() {
  const [items, setItems] = useState<AttentionNotification[]>([]);
  const [attentionLinks, setAttentionLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("id,target_type,target_id,message,read_at,created_at")
        .eq("user_id", userData.user.id)
        .eq("type", "admin_attention")
        .order("created_at", { ascending: false })
        .limit(25);

      if (error || !alive) return;

      const notifications = (data ?? []) as AttentionNotification[];
      setItems(notifications);

      const targetIds = Array.from(
        new Set(notifications.map((item) => item.target_id).filter((id): id is string => Boolean(id))),
      );
      if (targetIds.length === 0) {
        setAttentionLinks({});
        return;
      }

      const { data: attentionData, error: attentionError } = await supabase
        .from("admin_attention_items")
        .select("id,action_url")
        .in("id", targetIds);

      if (!attentionError && alive) {
        const links = Object.fromEntries(
          ((attentionData ?? []) as AttentionItemLink[]).map((item) => [item.id, item.action_url]),
        );
        setAttentionLinks(links);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const linked = useMemo(
    () =>
      items.flatMap((item) => {
        const href = item.target_id
          ? attentionLinks[item.target_id] ?? getLegacyAdminAttentionNotificationHref(item.target_type, item.target_id)
          : null;
        return href ? [{ ...item, href }] : [];
      }),
    [attentionLinks, items],
  );

  if (linked.length === 0) return null;

  return (
    <section className="notifications-editorial-admin-actions" aria-label="Admin action notifications">
      <div className="notifications-editorial-admin-actions-heading">
        <div>
          <span>Admin actions</span>
          <strong>Needs Attention notifications</strong>
        </div>
        <small>{linked.filter((item) => !item.read_at).length} unread</small>
      </div>
      <div className="notifications-editorial-admin-actions-list">
        {linked.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => {
              if (!item.read_at) {
                void supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", item.id);
              }
            }}
          >
            <AlertTriangle aria-hidden="true" size={17} />
            <span>{item.message}</span>
            <ChevronRight aria-hidden="true" size={16} />
          </Link>
        ))}
      </div>
    </section>
  );
}
