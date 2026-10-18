import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateArbitrage } from './arb-calculator.js';

test('splits a two-leg stake into an equal locked payout', () => {
  const result = calculateArbitrage([2.1, 2.02], 200);
  assert.equal(result.valid, true);
  assert.equal(result.isLocked, true);
  assert.ok(result.profit > 0);
  assert.equal(result.stakes.reduce((sum, value) => sum + value, 0), 200);
  assert.equal(result.payout, Math.min(result.stakes[0] * 2.1, result.stakes[1] * 2.02));
  assert.ok(result.stakes.every((value) => Number.isInteger(value * 100)));
});

test('supports three legs and detects when edited odds lose the lock', () => {
  const locked = calculateArbitrage([3.4, 3.5, 3.6], 300);
  assert.equal(locked.isLocked, true);
  assert.equal(locked.stakes.length, 3);
  const lost = calculateArbitrage([2.5, 2.5, 2.5], 300);
  assert.equal(lost.valid, true);
  assert.equal(lost.isLocked, false);
  assert.ok(lost.profitPct < 0);
});

test('rejects invalid odds instead of presenting a misleading result', () => {
  assert.equal(calculateArbitrage([2.1, 1], 200).valid, false);
  assert.equal(calculateArbitrage([2.1, Number.NaN], 200).valid, false);
});
