"use client";

import Link from "next/link";
import { ArrowLeft, Landmark, Loader2, ReceiptText, RefreshCw } from "lucide-react";
import { useParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Invoice = { id: string; member_id: string; title: string; description: string | null; invoice_type: string; amount_cents: number; due_at: string | null; effective_status: string; paid_cents: number; balance_cents: number; payments: Array<{ id: string; amount_cents: number; method: string; reference: string | null; paid_at: string }> };
type Payload = { room?: { id: string; name: string }; access?: { canManage: boolean }; invoices?: Invoice[]; summary?: { billed: number; paid: number; outstanding: number }; error?: string };

const money = (cents: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format((cents || 0) / 100);
const date = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "No due date";

export default function RoomFinanceClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""), [rawRoomId]);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);
  const [draft, setDraft] = useState({ memberId: "", title: "", description: "", invoiceType: "dues", amount: "", dueAt: "" });

  const request = useCallback(async (init?: RequestInit) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sign in again before continuing.");
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/finance`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) }, cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Room Finance could not complete this request.");
    return result as Payload;
  }, [roomId]);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true); setNotice(""); setIsError(false);
    try { setPayload(await request()); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Room Finance could not load."); setIsError(true); }
    finally { setLoading(false); }
  }, [request, roomId]);
  useEffect(() => { void load(); }, [load]);

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (working) return;
    setWorking("create"); setNotice(""); setIsError(false);
    try { await request({ method: "POST", body: JSON.stringify({ action: "create", ...draft, amount: Number(draft.amount) }) }); setDraft({ memberId: "", title: "", description: "", invoiceType: "dues", amount: "", dueAt: "" }); setNotice("Invoice created."); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Invoice creation failed."); setIsError(true); }
    finally { setWorking(""); }
  }

  async function act(invoiceId: string, action: string) {
    if (working) return;
    const amount = action === "record_payment" ? window.prompt("Payment amount") : null;
    if (action === "record_payment" && !amount) return;
    setWorking(invoiceId + action); setNotice(""); setIsError(false);
    try { await request({ method: "POST", body: JSON.stringify({ action, invoiceId, amount: amount ? Number(amount) : undefined, method: "manual" }) }); setNotice(action === "record_payment" ? "Payment recorded." : action === "waive" ? "Invoice waived." : "Reminder sent."); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Finance update failed."); setIsError(true); }
    finally { setWorking(""); }
  }

  return <main className="rooms-live-page min-h-screen px-4 py-6 sm:px-6"><div className="rooms-live-shell mx-auto max-w-6xl space-y-6">
    <Link href={`/rooms/${encodeURIComponent(roomId)}`} className="rooms-live-back-link !min-h-11"><ArrowLeft aria-hidden="true" /> Back to Room</Link>
    <header className="room-workspace-hero"><div><div className="room-workspace-badges"><span><Landmark aria-hidden="true" /> Private finance ledger</span></div><h1>{payload?.room?.name ? `${payload.room.name} finance` : "Room Finance"}</h1><p>Manage dues, invoices, balances, manual payments, receipts, and reminders.</p></div><button type="button" className="rooms-live-secondary-action !min-h-11" onClick={() => void load()} disabled={loading}><RefreshCw aria-hidden="true" className={loading ? "is-spinning" : undefined} /> Refresh</button></header>
    {notice ? <div role={isError ? "alert" : "status"} className={`room-expansion-notice${isError ? " is-error" : ""}`}>{notice}</div> : null}
    {payload?.summary ? <section className="grid gap-3 sm:grid-cols-3">{[["Billed", payload.summary.billed], ["Paid", payload.summary.paid], ["Outstanding", payload.summary.outstanding]].map(([label, value]) => <div key={String(label)} className="room-resources-empty"><p>{label}</p><h2>{money(Number(value))}</h2></div>)}</section> : null}
    {payload?.access?.canManage ? <form className="room-expansion-form" onSubmit={createInvoice}><div className="room-expansion-section-heading"><div><h2>Create an invoice</h2><p>Assign dues, fees, deposits, fines, or other charges to a Room member.</p></div><ReceiptText aria-hidden="true" /></div><div className="room-expansion-form-grid"><label><span>Member user ID</span><input required value={draft.memberId} onChange={(e) => setDraft((c) => ({ ...c, memberId: e.target.value }))} /></label><label><span>Type</span><select value={draft.invoiceType} onChange={(e) => setDraft((c) => ({ ...c, invoiceType: e.target.value }))}><option value="dues">Dues</option><option value="assessment">Assessment</option><option value="reservation_fee">Reservation fee</option><option value="deposit">Deposit</option><option value="fine">Fine</option><option value="donation">Donation</option><option value="other">Other</option></select></label><label><span>Title</span><input required value={draft.title} onChange={(e) => setDraft((c) => ({ ...c, title: e.target.value }))} /></label><label><span>Amount</span><input type="number" min="0" step="0.01" required value={draft.amount} onChange={(e) => setDraft((c) => ({ ...c, amount: e.target.value }))} /></label><label><span>Due date</span><input type="date" value={draft.dueAt} onChange={(e) => setDraft((c) => ({ ...c, dueAt: e.target.value }))} /></label></div><label><span>Description</span><textarea rows={3} value={draft.description} onChange={(e) => setDraft((c) => ({ ...c, description: e.target.value }))} /></label><button type="submit" className="rooms-live-primary-action !min-h-11" disabled={working === "create"}>{working === "create" ? <Loader2 className="is-spinning" aria-hidden="true" /> : <ReceiptText aria-hidden="true" />} Create invoice</button></form> : null}
    <section className="space-y-4">{(payload?.invoices ?? []).length === 0 && !loading ? <div className="room-resources-empty"><h2>No finance records yet</h2><p>Invoices and payment history available to your Room role will appear here.</p></div> : (payload?.invoices ?? []).map((invoice) => <article key={invoice.id} className="room-expansion-form space-y-3"><div className="room-resources-item-topline"><div><h2>{invoice.title}</h2><p className="room-resources-item-meta">{invoice.invoice_type.replaceAll("_", " ")} · Due {date(invoice.due_at)}</p></div><span className="rounded-full border px-2 py-1 text-xs capitalize">{invoice.effective_status}</span></div>{invoice.description ? <p>{invoice.description}</p> : null}<div className="grid gap-2 sm:grid-cols-3"><div><strong>Amount</strong><p>{money(invoice.amount_cents)}</p></div><div><strong>Paid</strong><p>{money(invoice.paid_cents)}</p></div><div><strong>Balance</strong><p>{money(invoice.balance_cents)}</p></div></div>{payload?.access?.canManage && invoice.effective_status !== "waived" ? <div className="flex flex-wrap gap-2"><button type="button" className="room-resources-button" onClick={() => void act(invoice.id, "record_payment")}>Record payment</button>{invoice.balance_cents > 0 ? <button type="button" className="room-resources-button is-quiet" onClick={() => void act(invoice.id, "remind")}>Send reminder</button> : null}<button type="button" className="room-resources-button is-quiet" onClick={() => void act(invoice.id, "waive")}>Waive</button></div> : null}</article>)}</section>
    {loading && !payload ? <div className="room-expansion-loading"><Loader2 className="is-spinning" aria-hidden="true" /> Loading Room finance…</div> : null}
  </div></main>;
}