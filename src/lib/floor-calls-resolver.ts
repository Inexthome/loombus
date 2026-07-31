import "server-only";

import { createFloorServiceSupabase } from "@/lib/floor-operations";
import { fetchDailyCloseOnOrBefore } from "@/lib/floor-market-data";

const BATCH_LIMIT = 25;

type DueCall = {
  id: string;
  ticker: string;
  comparator: string;
  target_value: number | null;
  target_value_high: number | null;
  resolves_by: string;
};

/**
 * "eq" rounds to the cent and compares for exact equality -- a near-impossible
 * bar for a continuously trading price. The admin review step is what catches
 * a technically-"incorrect" eq call that was obviously meant as "landed right
 * around here"; this resolver deliberately doesn't invent a tolerance band.
 */
function computeProposedOutcome(
  comparator: string,
  targetValue: number | null,
  targetValueHigh: number | null,
  close: number
): "correct" | "incorrect" | null {
  const rounded = Math.round(close * 100) / 100;

  if (comparator === "gte" && targetValue !== null) {
    return rounded >= targetValue ? "correct" : "incorrect";
  }
  if (comparator === "lte" && targetValue !== null) {
    return rounded <= targetValue ? "correct" : "incorrect";
  }
  if (comparator === "eq" && targetValue !== null) {
    return rounded === Math.round(targetValue * 100) / 100 ? "correct" : "incorrect";
  }
  if (comparator === "range" && targetValue !== null && targetValueHigh !== null) {
    return rounded >= targetValue && rounded <= targetValueHigh ? "correct" : "incorrect";
  }

  return null;
}

export type FloorCallsResolverSummary = {
  checked: number;
  proposed: number;
  skipped: number;
  errors: string[];
};

export async function runFloorCallsResolver(): Promise<FloorCallsResolverSummary> {
  const service = createFloorServiceSupabase();
  const summary: FloorCallsResolverSummary = { checked: 0, proposed: 0, skipped: 0, errors: [] };

  const { data: dueCalls, error } = await service
    .from("floor_calls")
    .select("id, ticker, comparator, target_value, target_value_high, resolves_by")
    .eq("status", "pending")
    .lte("resolves_by", new Date().toISOString())
    .order("resolves_by", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    summary.errors.push(`Unable to load due calls: ${error.message}`);
    return summary;
  }

  for (const call of (dueCalls ?? []) as DueCall[]) {
    summary.checked += 1;
    try {
      const { count: pendingProposalCount } = await service
        .from("floor_call_resolution_proposals")
        .select("id", { count: "exact", head: true })
        .eq("call_id", call.id)
        .eq("status", "pending");

      if (pendingProposalCount && pendingProposalCount > 0) {
        summary.skipped += 1;
        continue;
      }

      const close = await fetchDailyCloseOnOrBefore(call.ticker, new Date(call.resolves_by));
      if (!close) {
        summary.errors.push(`No market data for ${call.ticker} (call ${call.id}).`);
        continue;
      }

      const proposedOutcome = computeProposedOutcome(
        call.comparator,
        call.target_value,
        call.target_value_high,
        close.price
      );
      if (!proposedOutcome) {
        summary.errors.push(`Could not compute an outcome for ${call.ticker} (call ${call.id}).`);
        continue;
      }

      const { error: insertError } = await service.from("floor_call_resolution_proposals").insert({
        call_id: call.id,
        proposed_outcome: proposedOutcome,
        proposed_resolved_value: close.price,
        data_source: "twelve_data",
        resolved_on: close.tradingDate,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          summary.skipped += 1;
        } else {
          summary.errors.push(`Unable to save proposal for call ${call.id}: ${insertError.message}`);
        }
        continue;
      }

      summary.proposed += 1;
    } catch (cause) {
      summary.errors.push(
        `${call.ticker} (call ${call.id}): ${cause instanceof Error ? cause.message : "unknown error"}`
      );
    }
  }

  return summary;
}
