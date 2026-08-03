/**
 * Calibration: how well a member's stated conviction matched reality.
 * Backward-looking self-assessment only -- never a recommendation, never
 * "buy/sell". Mirrors floor-credibility.ts's shape and its house rule:
 * one formula, consumed identically wherever it's shown.
 *
 * Universe matches floor_member_credibility exactly: resolved binary calls
 * only (status='resolved' and outcome in ('correct','incorrect')). void
 * and partial are both excluded from numerator and denominator -- if that
 * ever needs to change, change it in floor_member_credibility /
 * floor-credibility.ts too, in the same commit, or the two surfaces will
 * disagree on what counts as a "hit" again.
 *
 * Two entry points, one shared core (computeFromBucketCounts):
 *   - calculateFloorCalibration(calls): raw {conviction, outcome} pairs --
 *     used wherever the caller already has per-call data (a member's own
 *     page, which can read their own floor_calls directly).
 *   - floorCalibrationFromBucketCounts(buckets): pre-aggregated per-
 *     conviction counts -- used to consume public.floor_member_calibration
 *     directly (the privacy-gated path for viewing ANOTHER member, since
 *     raw floor_calls access isn't scoped by the leaderboard opt-out the
 *     way that view is).
 * Both produce byte-identical results for the same underlying calls --
 * aggregating first changes nothing mathematically. See
 * scripts/verification/floor-calibration-parity.* for the proof.
 */

export type FloorCalibrationOutcome = "correct" | "incorrect";

export type FloorCalibrationCall = {
  conviction: number;
  outcome: FloorCalibrationOutcome;
};

export type FloorCalibrationBucketCounts = {
  conviction: number;
  correct: number;
  incorrect: number;
};

export type FloorCalibrationBucket = {
  conviction: number;
  n: number;
  correct: number;
  incorrect: number;
  /** 0-100, or null if this bucket has no resolved binary calls yet. */
  hitRate: number | null;
  /** 95% Wilson score interval, 0-100. Null alongside hitRate. */
  wilsonLow: number | null;
  wilsonHigh: number | null;
};

export type FloorCalibrationVerdict = "building" | "well-calibrated" | "overconfident" | "underconfident";

export type FloorCalibrationResult = {
  buckets: FloorCalibrationBucket[];
  resolvedBinaryCount: number;
  /** Null until resolvedBinaryCount reaches MIN_RESOLVED_FOR_HEADLINE. */
  brier: number | null;
  /** mean(stated probability) - overall hit rate. Positive = overconfident. */
  overconfidenceIndex: number | null;
  verdict: FloorCalibrationVerdict;
};

/**
 * House convention: what "conviction N" is taken to mean as a stated
 * probability of being correct, for Brier scoring. Deliberately kept in
 * exactly one place -- this is the only spot that should ever change it,
 * and any change here changes every member's Brier score and
 * overconfidence index at once. Disclosed in the UI wherever the Brier
 * headline is shown, since it's a modeling choice, not a fact.
 */
export const FLOOR_CONVICTION_PROBABILITY: Readonly<Record<number, number>> = {
  1: 0.55,
  2: 0.625,
  3: 0.7,
  4: 0.775,
  5: 0.85,
};

/** Below this many resolved binary calls, headline Brier/verdict are withheld. */
export const FLOOR_CALIBRATION_MIN_RESOLVED = 10;

// A bucket needs at least this many resolved calls before it's trusted
// enough to anchor the high-vs-low overperformance/underperformance check
// below -- a single lucky or unlucky call in a thin bucket shouldn't flip
// the verdict.
const TREND_BUCKET_MIN_N = 3;
// Overconfidence index further than this from zero (in probability
// points) is treated as a real gap rather than noise around a
// well-calibrated member.
const OVERCONFIDENCE_INDEX_THRESHOLD = 0.07;
// A gap this large (in hit-rate percentage points) between a member's
// lowest- and highest-populated conviction bucket, in the wrong direction,
// is what "high-conviction buckets underperform" means concretely.
const TREND_MARGIN_PCT = 10;

function clampProbability(value: number) {
  return Math.max(0, Math.min(1, value));
}

/**
 * 95% Wilson score interval for a binomial proportion -- reads as
 * uncertain for small n instead of presenting a bucket of 2 resolved
 * calls as a confident 100% or 0%.
 */
function wilsonInterval(correct: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const phat = correct / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = phat + z2 / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat)) / n + z2 / (4 * n * n));
  return [clampProbability((center - margin) / denominator), clampProbability((center + margin) / denominator)];
}

function computeFromBucketCounts(counts: Map<number, { correct: number; incorrect: number }>): FloorCalibrationResult {
  const buckets: FloorCalibrationBucket[] = [];
  for (let conviction = 1; conviction <= 5; conviction += 1) {
    const entry = counts.get(conviction) ?? { correct: 0, incorrect: 0 };
    const n = entry.correct + entry.incorrect;
    const hitRate = n > 0 ? (entry.correct / n) * 100 : null;
    const [wilsonLow, wilsonHigh] = n > 0 ? wilsonInterval(entry.correct, n) : [0, 0];
    buckets.push({
      conviction,
      n,
      correct: entry.correct,
      incorrect: entry.incorrect,
      hitRate,
      wilsonLow: n > 0 ? wilsonLow * 100 : null,
      wilsonHigh: n > 0 ? wilsonHigh * 100 : null,
    });
  }

  const resolvedBinaryCount = buckets.reduce((sum, bucket) => sum + bucket.n, 0);

  if (resolvedBinaryCount < FLOOR_CALIBRATION_MIN_RESOLVED) {
    return { buckets, resolvedBinaryCount, brier: null, overconfidenceIndex: null, verdict: "building" };
  }

  let sumSquaredError = 0;
  let sumStatedProbability = 0;
  let totalCorrect = 0;
  for (const bucket of buckets) {
    const p = FLOOR_CONVICTION_PROBABILITY[bucket.conviction];
    sumSquaredError += bucket.correct * (p - 1) ** 2 + bucket.incorrect * (p - 0) ** 2;
    sumStatedProbability += p * bucket.n;
    totalCorrect += bucket.correct;
  }
  const brier = sumSquaredError / resolvedBinaryCount;
  const overallHitRate = totalCorrect / resolvedBinaryCount;
  const meanStatedProbability = sumStatedProbability / resolvedBinaryCount;
  const overconfidenceIndex = meanStatedProbability - overallHitRate;

  const verdict = deriveVerdict(buckets, overconfidenceIndex);

  return { buckets, resolvedBinaryCount, brier, overconfidenceIndex, verdict };
}

/**
 * "Well-calibrated" means stated confidence tracked results in both
 * senses: the aggregate gap between what a member claimed and what
 * actually happened is small (overconfidenceIndex), AND high-conviction
 * calls didn't do WORSE than low-conviction ones (the trend a genuinely
 * overconfident member would show -- more sure of themselves exactly
 * where they're least reliable). Either signal alone can trip the
 * verdict; both thresholds are intentionally in one place, above, so
 * they're easy to find and tune together.
 */
function deriveVerdict(buckets: FloorCalibrationBucket[], overconfidenceIndex: number): FloorCalibrationVerdict {
  if (overconfidenceIndex > OVERCONFIDENCE_INDEX_THRESHOLD) return "overconfident";
  if (overconfidenceIndex < -OVERCONFIDENCE_INDEX_THRESHOLD) return "underconfident";

  const populated = buckets.filter((bucket) => bucket.n >= TREND_BUCKET_MIN_N);
  if (populated.length >= 2) {
    const lowest = populated[0];
    const highest = populated[populated.length - 1];
    if ((highest.hitRate ?? 0) < (lowest.hitRate ?? 0) - TREND_MARGIN_PCT) {
      return "overconfident";
    }
  }

  return "well-calibrated";
}

export function calculateFloorCalibration(calls: FloorCalibrationCall[]): FloorCalibrationResult {
  const counts = new Map<number, { correct: number; incorrect: number }>();
  for (const call of calls) {
    const entry = counts.get(call.conviction) ?? { correct: 0, incorrect: 0 };
    if (call.outcome === "correct") entry.correct += 1;
    else entry.incorrect += 1;
    counts.set(call.conviction, entry);
  }
  return computeFromBucketCounts(counts);
}

export function floorCalibrationFromBucketCounts(buckets: FloorCalibrationBucketCounts[]): FloorCalibrationResult {
  const counts = new Map<number, { correct: number; incorrect: number }>();
  for (const bucket of buckets) {
    counts.set(bucket.conviction, { correct: bucket.correct, incorrect: bucket.incorrect });
  }
  return computeFromBucketCounts(counts);
}

export function floorCalibrationVerdictCopy(verdict: FloorCalibrationVerdict): string {
  switch (verdict) {
    case "well-calibrated":
      return "Your stated conviction has tracked your results.";
    case "overconfident":
      return "Your highest-conviction calls have not outperformed your lower-conviction ones as much as stated confidence would suggest.";
    case "underconfident":
      return "You have been right more often than your stated conviction would suggest.";
    case "building":
    default:
      return "Not enough resolved calls yet to read a pattern.";
  }
}
