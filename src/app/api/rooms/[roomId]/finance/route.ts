import { NextResponse, type NextRequest } from "next/server";
import { createNotification } from "@/lib/notifications";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { asString, createRequestSupabase, createRoomServiceSupabase, getRoomAccess } from "@/lib/room-operations";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ roomId: string }> };
const json = (payload: unknown, status = 200) => NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store" } });
const missingSchema = (error: { code?: string } | null) => error?.code === "42P01" || error?.code === "42703";
const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

async function authorize(request: NextRequest, roomId: string) {
  const requestSupabase = createRequestSupabase(request);
  const account = await verifyRequestAccountAccess(requestSupabase);
  if (!account.ok) return { error: json({ error: account.error }, account.status) };
  const service = createRoomServiceSupabase();
  const access = await getRoomAccess(service, roomId, account.user.id).catch(() => null);
  if (!access) return { error: json({ error: "Room not found." }, 404) };
  if (!access.allowed) return { error: json({ error: "Room membership is required." }, 403) };
  return { service, access, userId: account.user.id };
}

export async function GET(request: NextRequest, context: Context) {
  const { roomId } = await context.params;
  if (!validUuid(roomId)) return json({ error: "Invalid Room id." }, 400);
  const auth = await authorize(request, roomId);
  if ("error" in auth) return auth.error;
  const { service, access, userId } = auth;

  let invoicesQuery = service.from("room_finance_invoices").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(500);
  if (!access.canManage) invoicesQuery = invoicesQuery.eq("member_id", userId);
  const invoicesResult = await invoicesQuery;
  if (missingSchema(invoicesResult.error)) return json({ error: "Room Finance requires the pending database migration.", code: "room_finance_migration_required" }, 503);
  if (invoicesResult.error) return json({ error: "Finance records could not be loaded." }, 503);

  const ids = (invoicesResult.data ?? []).map((row) => asString(row.id)).filter(Boolean);
  const paymentsResult = ids.length ? await service.from("room_finance_payments").select("*").in("invoice_id", ids).order("paid_at", { ascending: false }) : { data: [], error: null };
  if (paymentsResult.error) return json({ error: "Payment records could not be loaded." }, 503);
  const payments = paymentsResult.data ?? [];
  const invoices = (invoicesResult.data ?? []).map((invoice) => {
    const paidCents = payments.filter((payment) => asString(payment.invoice_id) === asString(invoice.id)).reduce((sum, payment) => sum + Number(payment.amount_cents ?? 0), 0);
    const balanceCents = Math.max(0, Number(invoice.amount_cents ?? 0) - paidCents);
    const overdue = invoice.status === "open" && invoice.due_at && new Date(asString(invoice.due_at)).getTime() < Date.now() && balanceCents > 0;
    return { ...invoice, paid_cents: paidCents, balance_cents: balanceCents, effective_status: invoice.status === "waived" ? "waived" : balanceCents === 0 ? "paid" : overdue ? "overdue" : "open", payments: payments.filter((payment) => asString(payment.invoice_id) === asString(invoice.id)) };
  });
  const summary = invoices.reduce((acc, invoice) => ({ billed: acc.billed + Number(invoice.amount_cents ?? 0), paid: acc.paid + Number(invoice.paid_cents ?? 0), outstanding: acc.outstanding + Number(invoice.balance_cents ?? 0) }), { billed: 0, paid: 0, outstanding: 0 });
  return json({ room: { id: access.room.id, name: access.room.name }, access: { role: access.role, canManage: access.canManage }, invoices, summary });
}

export async function POST(request: NextRequest, context: Context) {
  const { roomId } = await context.params;
  if (!validUuid(roomId)) return json({ error: "Invalid Room id." }, 400);
  const auth = await authorize(request, roomId);
  if ("error" in auth) return auth.error;
  const { service, access, userId } = auth;
  if (!access.canManage) return json({ error: "Room management is required." }, 403);
  const body = await request.json().catch(() => ({}));
  const action = clean(body.action, 40);

  if (action === "create") {
    const memberId = clean(body.memberId, 60);
    const title = clean(body.title, 240);
    const amountCents = Math.round(Number(body.amount ?? 0) * 100);
    if (!validUuid(memberId) || title.length < 2 || !Number.isFinite(amountCents) || amountCents < 0) return json({ error: "Choose a member and enter a valid title and amount." }, 400);
    const inserted = await service.from("room_finance_invoices").insert({ room_id: roomId, member_id: memberId, created_by: userId, title, description: clean(body.description, 4000) || null, invoice_type: clean(body.invoiceType, 40) || "dues", amount_cents: amountCents, currency: "USD", due_at: body.dueAt ? new Date(body.dueAt).toISOString() : null, status: "open" }).select("*").single();
    if (missingSchema(inserted.error)) return json({ error: "Room Finance requires the pending database migration.", code: "room_finance_migration_required" }, 503);
    if (inserted.error) return json({ error: "The invoice could not be created." }, 503);
    await createNotification({ user_id: memberId, actor_id: userId, type: "room_finance_invoice_created", target_type: "room_finance_invoice", target_id: asString(inserted.data.id), room_id: roomId, message: `${title} was added to your Room balance.` }).catch(() => null);
    return json({ ok: true, invoice: inserted.data }, 201);
  }

  const invoiceId = clean(body.invoiceId, 60);
  if (!validUuid(invoiceId)) return json({ error: "Invalid invoice." }, 400);
  const current = await service.from("room_finance_invoices").select("*").eq("id", invoiceId).eq("room_id", roomId).maybeSingle();
  if (current.error || !current.data) return json({ error: "Invoice not found." }, 404);

  if (action === "record_payment") {
    const amountCents = Math.round(Number(body.amount ?? 0) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) return json({ error: "Enter a valid payment amount." }, 400);
    const inserted = await service.from("room_finance_payments").insert({ room_id: roomId, invoice_id: invoiceId, member_id: current.data.member_id, recorded_by: userId, amount_cents: amountCents, currency: "USD", method: clean(body.method, 40) || "manual", reference: clean(body.reference, 200) || null, note: clean(body.note, 1000) || null }).select("*").single();
    if (inserted.error) return json({ error: "The payment could not be recorded." }, 503);
    await createNotification({ user_id: asString(current.data.member_id), actor_id: userId, type: "room_finance_payment_recorded", target_type: "room_finance_invoice", target_id: invoiceId, room_id: roomId, message: `A payment was recorded for ${asString(current.data.title)}.` }).catch(() => null);
    return json({ ok: true, payment: inserted.data }, 201);
  }
  if (action === "waive") {
    const updated = await service.from("room_finance_invoices").update({ status: "waived", waived_at: new Date().toISOString(), waived_by: userId, updated_at: new Date().toISOString() }).eq("id", invoiceId).select("*").single();
    if (updated.error) return json({ error: "The invoice could not be waived." }, 503);
    return json({ ok: true, invoice: updated.data });
  }
  if (action === "remind") {
    await createNotification({ user_id: asString(current.data.member_id), actor_id: userId, type: "room_finance_payment_reminder", target_type: "room_finance_invoice", target_id: invoiceId, room_id: roomId, message: `Payment reminder: ${asString(current.data.title)} remains outstanding.` }).catch(() => null);
    return json({ ok: true });
  }
  return json({ error: "Unsupported finance action." }, 400);
}