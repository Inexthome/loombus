from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one anchor, found {count}: {old[:100]!r}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "src/app/rooms/[roomId]/live-room-workspace-client.tsx",
    "  Clock3,\n  FileText,",
    "  Clock3,\n  CreditCard,\n  FileText,",
)
replace_once(
    "src/app/rooms/[roomId]/live-room-workspace-client.tsx",
    '''          <div className="room-workspace-hero-actions">\n            <button''',
    '''          <div className="room-workspace-hero-actions">\n            {access.role === "owner" ? (\n              <Link\n                href={`/rooms/${encodeURIComponent(room.id)}/billing`}\n                className="rooms-live-secondary-action"\n              >\n                <CreditCard aria-hidden="true" />\n                Billing\n              </Link>\n            ) : null}\n            <button''',
)
replace_once(
    "src/lib/room-billing-management.ts",
    '''  ROOM_PLAN_ENTITLEMENTS,\n  normalizeRoomPlanKey,''',
    '''  ROOM_PLAN_ENTITLEMENTS,\n  getRoomPlanEntitlements,\n  normalizeRoomPlanKey,''',
)
replace_once(
    "src/lib/room-billing-management.ts",
    '''      hostedInvoiceUrl: invoice.hosted_invoice_url,\n      invoicePdf: invoice.invoice_pdf,''',
    '''      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,\n      invoicePdf: invoice.invoice_pdf ?? null,''',
)
replace_once(
    "src/lib/room-billing-management.ts",
    '''  return {\n    room: {\n      id: String(room.id),\n      name: String(room.name ?? "Room"),\n      planKey,\n      subscriptionStatus: subscription?.status ?? String(room.subscription_status ?? "active"),''',
    '''  const subscriptionStatus =\n    subscription?.status ?? String(room.subscription_status ?? "active");\n  const effectivePlan = getRoomPlanEntitlements(planKey, subscriptionStatus);\n\n  return {\n    room: {\n      id: String(room.id),\n      name: String(room.name ?? "Room"),\n      planKey: effectivePlan.id,\n      subscribedPlanKey: planKey,\n      subscriptionStatus,''',
)
replace_once(
    "src/lib/room-billing-management.ts",
    '''    currentPlan: planSummary(planKey),\n    availablePlans: (Object.keys(ROOM_PLAN_ENTITLEMENTS) as RoomPlanKey[]).map(planSummary),\n    usage: {\n      memberCount,\n      memberLimit: ROOM_PLAN_ENTITLEMENTS[planKey].memberLimit,\n      usedStorageBytes,\n      storageLimitBytes: ROOM_PLAN_ENTITLEMENTS[planKey].storageBytes,\n    },''',
    '''    currentPlan: planSummary(effectivePlan.id),\n    availablePlans: (Object.keys(ROOM_PLAN_ENTITLEMENTS) as RoomPlanKey[]).map(planSummary),\n    usage: {\n      memberCount,\n      memberLimit: effectivePlan.memberLimit,\n      usedStorageBytes,\n      storageLimitBytes: effectivePlan.storageBytes,\n      overMemberLimit:\n        effectivePlan.memberLimit !== null && memberCount > effectivePlan.memberLimit,\n      overStorageLimit:\n        usedStorageBytes !== null && usedStorageBytes > effectivePlan.storageBytes,\n    },''',
)
replace_once(
    "src/lib/room-billing-management.ts",
    '''  const memberCount = await activeMemberCount(roomId);\n  const targetLimit = PAID_ROOM_PLANS[targetPlan].memberLimit;\n  if (targetLimit !== null && memberCount > targetLimit) {''',
    '''  const memberCount = await activeMemberCount(roomId);\n  const usedStorageBytes = await storageUsage(roomId);\n  const targetLimit = PAID_ROOM_PLANS[targetPlan].memberLimit;\n  const targetStorageBytes = ROOM_PLAN_ENTITLEMENTS[targetPlan].storageBytes;\n  if (targetLimit !== null && memberCount > targetLimit) {''',
)
replace_once(
    "src/lib/room-billing-management.ts",
    '''      "room_plan_member_limit_exceeded"\n    );\n  }\n\n  const stripe = getStripe();''',
    '''      "room_plan_member_limit_exceeded"\n    );\n  }\n  if (usedStorageBytes !== null && usedStorageBytes > targetStorageBytes) {\n    throw new RoomBillingError(\n      `This Room uses ${usedStorageBytes} bytes of storage. Remove files until usage is within the ${targetStorageBytes}-byte allowance before changing to ${PAID_ROOM_PLANS[targetPlan].label}.`,\n      409,\n      "room_plan_storage_limit_exceeded"\n    );\n  }\n\n  const stripe = getStripe();''',
)
replace_once(
    "src/lib/room-billing-management.ts",
    '''  const subscription = await getStripe().subscriptions.update(subscriptionId, {\n    cancel_at_period_end: cancelAtPeriodEnd,\n  });''',
    '''  if (cancelAtPeriodEnd) {\n    const memberCount = await activeMemberCount(roomId);\n    const usedStorageBytes = await storageUsage(roomId);\n    const freePlan = ROOM_PLAN_ENTITLEMENTS.free;\n    if (freePlan.memberLimit !== null && memberCount > freePlan.memberLimit) {\n      throw new RoomBillingError(\n        `Reduce active membership to ${freePlan.memberLimit} or fewer before scheduling cancellation to Free.`,\n        409,\n        "room_free_member_limit_exceeded"\n      );\n    }\n    if (usedStorageBytes !== null && usedStorageBytes > freePlan.storageBytes) {\n      throw new RoomBillingError(\n        "Remove paid Room files before scheduling cancellation to Free.",\n        409,\n        "room_free_storage_limit_exceeded"\n      );\n    }\n  }\n  const subscription = await getStripe().subscriptions.update(subscriptionId, {\n    cancel_at_period_end: cancelAtPeriodEnd,\n  });''',
)
replace_once(
    "src/app/rooms/[roomId]/billing/room-billing-client.tsx",
    '''    planKey: string;\n    subscriptionStatus: string;''',
    '''    planKey: string;\n    subscribedPlanKey: string;\n    subscriptionStatus: string;''',
)
replace_once(
    "src/app/rooms/[roomId]/billing/room-billing-client.tsx",
    '''    storageLimitBytes: number;\n  };''',
    '''    storageLimitBytes: number;\n    overMemberLimit: boolean;\n    overStorageLimit: boolean;\n  };''',
)
replace_once(
    "src/app/rooms/[roomId]/billing/room-billing-client.tsx",
    '''        {overview.room.cancelAtPeriodEnd ? (\n          <div className="rooms-live-notice is-error">''',
    '''        {overview.usage.overMemberLimit || overview.usage.overStorageLimit ? (\n          <div className="rooms-live-notice is-error">\n            This Room is above the active plan capacity. New paid-only activity may remain limited until membership or storage is reduced, or the Room is upgraded.\n          </div>\n        ) : null}\n\n        {overview.room.cancelAtPeriodEnd ? (\n          <div className="rooms-live-notice is-error">''',
)
