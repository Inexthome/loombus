// Proves the two entry points in src/lib/floor-calibration.ts -- raw
// per-call pairs (calculateFloorCalibration) and pre-aggregated bucket
// counts (floorCalibrationFromBucketCounts, the shape
// public.floor_member_calibration returns) -- produce byte-identical
// results for the same underlying calls. Aggregating first is what lets
// the analyst page consume the privacy-gated SQL view instead of raw
// floor_calls when viewing another member; this is the guarantee that
// doing so never disagrees with computing straight from a member's own
// raw calls.
//
// Pure TS, no database needed. Run with:
//   node --experimental-strip-types scripts/verification/floor-calibration-parity.mts
//
// See floor-calibration-parity.sql for the complementary check that the
// SQL view's own GROUP BY produces the same bucket counts this fixture
// assumes.

import {
  calculateFloorCalibration,
  floorCalibrationFromBucketCounts,
  type FloorCalibrationCall,
} from "../../src/lib/floor-calibration.ts";

// Fixed fixture: 18 resolved binary calls across 5 conviction levels.
// conviction 4 deliberately underperforms conviction 1-3 (overconfidence
// signal); conviction 5 is thin (n=2, below the trend-check minimum).
const FIXTURE: FloorCalibrationCall[] = [
  ...Array(2).fill({ conviction: 1, outcome: "correct" as const }),
  { conviction: 1, outcome: "incorrect" },
  ...Array(2).fill({ conviction: 2, outcome: "correct" as const }),
  ...Array(2).fill({ conviction: 2, outcome: "incorrect" as const }),
  ...Array(3).fill({ conviction: 3, outcome: "correct" as const }),
  { conviction: 3, outcome: "incorrect" },
  ...Array(2).fill({ conviction: 4, outcome: "correct" as const }),
  ...Array(3).fill({ conviction: 4, outcome: "incorrect" as const }),
  { conviction: 5, outcome: "correct" },
  { conviction: 5, outcome: "incorrect" },
];

const EXPECTED_BUCKET_COUNTS = [
  { conviction: 1, correct: 2, incorrect: 1 },
  { conviction: 2, correct: 2, incorrect: 2 },
  { conviction: 3, correct: 3, incorrect: 1 },
  { conviction: 4, correct: 2, incorrect: 3 },
  { conviction: 5, correct: 1, incorrect: 1 },
];

let failures = 0;

function check(label: string, condition: boolean) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition) failures += 1;
}

const fromRaw = calculateFloorCalibration(FIXTURE);
const fromCounts = floorCalibrationFromBucketCounts(EXPECTED_BUCKET_COUNTS);

check("resolvedBinaryCount matches fixture size (18)", fromRaw.resolvedBinaryCount === 18);
check(
  "raw-pairs entry point agrees with pre-aggregated-counts entry point (deep equal)",
  JSON.stringify(fromRaw) === JSON.stringify(fromCounts)
);
check("brier is populated once n >= 10", fromRaw.brier !== null);
check("verdict is not 'building' once n >= 10", fromRaw.verdict !== "building");

// Sanity-check one bucket by hand: conviction 3 has 3 correct, 1
// incorrect -> hit rate 75%.
const bucket3 = fromRaw.buckets.find((b) => b.conviction === 3);
check("conviction-3 bucket hit rate is 75%", bucket3?.hitRate === 75);

// Below the n=10 floor, both entry points should report "building" with
// null brier/overconfidenceIndex, not partial numbers.
const thin = calculateFloorCalibration(FIXTURE.slice(0, 5));
check("below the resolved-call floor reports verdict 'building'", thin.verdict === "building");
check("below the resolved-call floor withholds brier", thin.brier === null);

console.log(`\n${failures === 0 ? "PASS" : "FAIL"}  ${failures} failing check(s) out of 7`);
process.exit(failures === 0 ? 0 : 1);
