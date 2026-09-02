import { NextRequest, NextResponse } from "next/server";
import { getBillingSupabaseAdmin } from "@/lib/billing-entitlements";
import { getMemberPayoutIdentity, refreshMemberPayoutAccount } from "@/lib/member-payout-account-server";
import { requireMemberUser } from "@/lib/member-privacy-server";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function GET(request: NextRequest) {
  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const admin = getBillingSupabaseAdmin();
  const [purchaseResult, salesResult] = await Promise.all([
    (admin.from("library_book_purchases") as any)
      .select("id,publication_id,status,amount_cents,currency,platform_fee_cents,purchased_at,refunded_at,disputed_at,created_at")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(250),
    (admin.from("library_book_purchases") as any)
      .select("id,publication_id,status,amount_cents,currency,platform_fee_cents,purchased_at,refunded_at,disputed_at,created_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (purchaseResult.error || salesResult.error) {
    console.error("Unable to load Library commerce ledger.", purchaseResult.error ?? salesResult.error);
    return jsonError("Unable to load Library commerce activity.", 503);
  }

  const purchases = purchaseResult.data ?? [];
  const sales = salesResult.data ?? [];
  const publicationIds = [...new Set([...purchases, ...sales].map((row: any) => row.publication_id).filter(Boolean))];
  let publicationById = new Map<string, any>();

  if (publicationIds.length > 0) {
    const { data, error } = await (admin.from("library_publications") as any)
      .select("id,title,author_name,status,is_free,price_cents,currency,cover_url")
      .in("id", publicationIds);
    if (error) return jsonError("Unable to load Library publication details.", 503);
    publicationById = new Map((data ?? []).map((publication: any) => [publication.id, publication]));
  }

  let payout = await getMemberPayoutIdentity(user.id);
  if (payout) {
    try {
      payout = await refreshMemberPayoutAccount(user.id);
    } catch (error) {
      console.error("Unable to refresh Library payout state.", error);
    }
  }

  const paidSales = sales.filter((row: any) => row.status === "paid" || row.status === "disputed");
  const grossCents = paidSales.reduce((sum: number, row: any) => sum + Number(row.amount_cents ?? 0), 0);
  const platformFeeCents = paidSales.reduce((sum: number, row: any) => sum + Number(row.platform_fee_cents ?? 0), 0);

  return NextResponse.json(
    {
      purchases: purchases.map((row: any) => ({ ...row, publication: publicationById.get(row.publication_id) ?? null })),
      sales: sales.map((row: any) => ({
        ...row,
        author_share_cents: Math.max(0, Number(row.amount_cents ?? 0) - Number(row.platform_fee_cents ?? 0)),
        publication: publicationById.get(row.publication_id) ?? null,
      })),
      summary: {
        sale_count: paidSales.length,
        gross_cents: grossCents,
        platform_fee_cents: platformFeeCents,
        author_share_cents: Math.max(0, grossCents - platformFeeCents),
      },
      payout: payout
        ? {
            details_submitted: payout.details_submitted,
            charges_enabled: payout.charges_enabled,
            payouts_enabled: payout.payouts_enabled,
            requirements_due: payout.requirements_due,
          }
        : null,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
