import assert from 'node:assert/strict';
import { applyArbCorrections, arbAttemptMetrics, arbOfferTermsChanged, arbPlacedScenario, describeArbOfferChange } from './arb-metrics.js';

const attempts = [
  { id: 'a', started_at: '2026-09-22T12:00:00Z' },
  { id: 'b', started_at: null, status: 'rejected' },
  { id: 'c', started_at: '2026-09-22T12:00:00Z' },
];
const legs = [
  { attempt_id: 'a', status: 'settled', placed_at: '2026-09-22T12:00:10Z', actual_stake: 10, returned_amount: 20, offered_odds: 2, actual_odds: 2 },
  { attempt_id: 'a', status: 'settled', placed_at: '2026-09-22T12:00:20Z', actual_stake: 10, returned_amount: 0, offered_odds: 2, actual_odds: 2 },
  { attempt_id: 'c', status: 'placed', placed_at: '2026-09-22T12:00:15Z', actual_stake: 10, offered_odds: 2, actual_odds: 2.1 },
  { attempt_id: 'c', status: 'unavailable' },
];
const metrics = arbAttemptMetrics(attempts, legs);
assert.ok(Math.abs(metrics.averageOddsChangePct - 5 / 3) < 1e-9);
assert.deepEqual({ ...metrics, averageOddsChangePct: undefined }, {
  started: 2, fullyPlaced: 1, successPct: 50, averageSeconds: 20,
  settledLegs: 2, realizedPnl: 0,
  partialWithStake: 1, rejectedWithoutTimer: 1, averageOddsChangePct: undefined,
});
assert.deepEqual(arbPlacedScenario(legs.slice(0, 2)), {
  totalStake: 20, minPayout: 20, theoreticalWorstPnl: 0,
});
assert.equal(arbPlacedScenario(legs.slice(2)), null);
assert.deepEqual(describeArbOfferChange({
  outcomes_json: [{ side: '1', book: 'A', odds: 2.1 }, { side: '2', book: 'B', odds: 2.1 }],
}, {
  legs: [{ outcome: '1', book: 'A', odds: 2.1 }, { outcome: '2', book: 'C', odds: 2.2 }],
}), ['2: B @ 2.10 → C @ 2.20']);
const oldOffer = { id: 'ARB_same', arb_key: 'terms-a', outcomes_json: [
  { side: '1', book: 'A', odds: 2.1 }, { side: '2', book: 'B', odds: 2.1 },
] };
assert.equal(arbOfferTermsChanged(oldOffer, { id: 'ARB_same', arbKey: 'terms-a',
  sourceUpdatedAt: '2026-09-23T10:30:00Z' }), false);
assert.equal(arbOfferTermsChanged(oldOffer, { id: 'ARB_same', arbKey: 'terms-b',
  sourceUpdatedAt: '2026-09-23T10:30:00Z' }), true);
assert.equal(arbOfferTermsChanged(oldOffer, { id: 'ARB_same', legs: [
  { outcome: '1', book: 'A', odds: 2.1 }, { outcome: '2', book: 'B', odds: 2.2 },
] }), true);

const original = [{
  id: 'leg-1', status: 'settled', actual_book: 'A', actual_odds: 2,
  actual_stake: 10, result: 'win', returned_amount: 20,
}];
const corrections = [
  { id: 'c-1', leg_id: 'leg-1', created_at: '2026-09-22T12:00:00Z', actual_book: 'B', actual_odds: 2.1, actual_stake: 12, result: 'win', returned_amount: 25.2 },
  { id: 'c-2', leg_id: 'leg-1', created_at: '2026-09-22T12:01:00Z', actual_book: 'B', actual_odds: 2.2, actual_stake: 12, result: 'lose', returned_amount: 0 },
];
const effective = applyArbCorrections(original, corrections);
assert.equal(original[0].actual_book, 'A');
assert.equal(original[0].returned_amount, 20);
assert.deepEqual(effective.map(l => [l.actual_book, l.actual_odds, l.actual_stake, l.result, l.returned_amount, l.correctionCount]),
  [['B', 2.2, 12, 'lose', 0, 2]]);
assert.equal(arbAttemptMetrics([{ id: 'attempt', started_at: '2026-09-22T11:59:00Z' }],
  [{ ...effective[0], attempt_id: 'attempt', placed_at: '2026-09-22T12:00:00Z' }]).realizedPnl, -12);

const preSettlementCorrection = [{
  id: 'c-pre', leg_id: 'leg-1', created_at: '2026-09-22T11:58:00Z',
  actual_book: 'B', actual_odds: 2.2, actual_stake: 12,
  result: null, returned_amount: null,
}];
assert.deepEqual(
  applyArbCorrections([{ ...original[0], returned_amount: 26.4 }], preSettlementCorrection)
    .map(l => [l.actual_book, l.actual_stake, l.result, l.returned_amount]),
  [['B', 12, 'win', 26.4]],
);
assert.deepEqual(
  applyArbCorrections(original, [...corrections].reverse())
    .map(l => [l.effectiveCorrectionId, l.returned_amount, l.correctionCount]),
  [['c-2', 0, 2]],
);
