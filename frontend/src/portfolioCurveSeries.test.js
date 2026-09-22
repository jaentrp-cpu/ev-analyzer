import assert from 'node:assert/strict';
import { buildPortfolioCurveSeries } from './portfolioCurveSeries.js';

const result = buildPortfolioCurveSeries([
  { stake: 100, pnl: 40, ev: 5, clvPct: 3, clvUsable: true },
  { stake: 50, pnl: -50, ev: 4, clvPct: 8, clvUsable: false },
  { stake: 25, pnl: 0, ev: null, clvPct: -2, clvUsable: true },
]);
assert.deepEqual(result.actual, [0, 40, -10, -10]);
assert.deepEqual(result.ev, [0, 5, 7, 7]);
assert.deepEqual(result.clv, [0, 3, 3, 2.5]);
assert.equal(result.evRows, 2);
assert.equal(result.clvRows, 2);
console.log('portfolioCurveSeries tests passed');
