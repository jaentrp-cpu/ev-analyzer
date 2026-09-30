import test from "node:test";
import assert from "node:assert/strict";
import { arbBankroll, arbTiming } from "./arb-bankroll.js";
import { applyArbCorrections } from "./arb-metrics.js";
const attempts = [
  {
    id: "a",
    started_at: "2026-09-30T10:01:00Z",
    source_updated_at: "2026-09-30T10:00:00Z",
  },
];
const legs = [
  {
    id: "1",
    attempt_id: "a",
    status: "settled",
    actual_stake: 150,
    returned_amount: 306,
    settled_at: "2026-09-30T12:00:00Z",
    placed_at: "2026-09-30T10:01:20Z",
    offered_odds: 2.04,
    actual_odds: 2.04,
  },
  {
    id: "2",
    attempt_id: "a",
    status: "settled",
    actual_stake: 150,
    returned_amount: 0,
    settled_at: "2026-09-30T12:00:01Z",
  },
];
test("300 euro bankroll grows only by the recorded 6 euro net profit", () => {
  const s = arbBankroll(attempts, legs, 300);
  assert.equal(s.total, 306);
  assert.equal(s.pnl, 6);
  assert.equal(s.available, 306);
  assert.equal(s.curve.at(-1).pnl, 6);
  assert.equal(arbBankroll(attempts, legs, 900).pnl, 6);
});
test("open stakes are committed money, never profit", () => {
  const s = arbBankroll(attempts, [{ ...legs[0], status: "placed" }], 300);
  assert.equal(s.pnl, 0);
  assert.equal(s.total, 300);
  assert.equal(s.available, 150);
  assert.deepEqual(s.curve, []);
});
test("deletion removes effects and restoration restores them without changing source rows", () => {
  const before = JSON.stringify(legs);
  assert.equal(
    arbBankroll([{ ...attempts[0], deleted_at: "2026-09-30" }], legs, 300)
      .total,
    300,
  );
  assert.equal(arbBankroll(attempts, legs, 300).total, 306);
  assert.equal(JSON.stringify(legs), before);
});
test("latest correction changes money but never original placement time", () => {
  const corrected = applyArbCorrections(legs, [
    {
      id: "c",
      leg_id: "1",
      actual_book: "B",
      actual_odds: 2.02,
      actual_stake: 150,
      returned_amount: 303,
      result: "win",
      created_at: "2026-09-30T13:00:00Z",
    },
  ]);
  assert.equal(arbBankroll(attempts, corrected, 300).pnl, 3);
  assert.equal(arbTiming(attempts[0], corrected)[0].attemptSeconds, 20);
  assert.equal(arbTiming(attempts[0], corrected)[0].observationSeconds, 80);
  assert.equal(arbTiming(attempts[0], corrected)[0].sameOdds, false);
});
test("missing timestamps never become a fabricated duration", () => {
  assert.equal(arbTiming({ started_at: null }, legs)[0].attemptSeconds, null);
  assert.equal(
    arbBankroll(attempts, [{ ...legs[0], settled_at: null }], 300)
      .missingResultTimes,
    1,
  );
});

test("one completed attempt creates one profit point rather than winning/losing-leg spikes", () => {
  const s = arbBankroll(attempts, legs, 300);
  assert.equal(s.curve.length, 1);
  assert.equal(s.curve[0].pnl, 6);
  const partial = arbBankroll(
    [{ ...attempts[0], status: "partial" }],
    [legs[0], { ...legs[1], status: "placed" }],
    300,
  );
  assert.equal(partial.curve.length, 0);
  assert.equal(partial.partialPnl, 156);
});
test("failed checks have their own observed time without inventing placement", () => {
  const row = arbTiming(attempts[0], [
    {
      offered_odds: 2.04,
      actual_odds: 2,
      checked_at: "2026-09-30T10:01:30Z",
      status: "unavailable",
    },
  ])[0];
  assert.equal(row.attemptSeconds, 30);
  assert.equal(row.observationSeconds, 90);
  assert.equal(row.sameOdds, false);
});

test("legacy returns remain explicitly unverified until net receipts are confirmed", () => {
  assert.equal(arbBankroll(attempts, legs, 300).unverifiedReturns, 2);
  const verified = legs.map((l) => ({ ...l, net_return_verified: true }));
  assert.equal(arbBankroll(attempts, verified, 300).unverifiedReturns, 0);
  assert.equal(arbBankroll(attempts, verified, 300).pnl, 6);
});
