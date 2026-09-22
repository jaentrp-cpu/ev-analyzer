import test from 'node:test';
import assert from 'node:assert/strict';
import {
  betInAnalyticsRange,
  buildDailyBetSummaries,
  calculateBankrollReturn,
  calculateSettledReturn,
  localDateKey,
  normalizeAnalyticsRange,
} from './portfolio-analytics.js';

function localDate(offsetDays, hour = 12) {
  const value = new Date();
  value.setHours(hour, 0, 0, 0);
  value.setDate(value.getDate() + offsetDays);
  return value;
}

function isoDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test('normalizes only supported analytics ranges', () => {
  for (const range of ['all', 'today', 'tomorrow', 'yesterday', 'day_before_yesterday', '7d', '30d', '90d', 'custom']) {
    assert.equal(normalizeAnalyticsRange(range), range);
  }
  assert.equal(normalizeAnalyticsRange('unsupported'), '30d');
});

test('range filters select today, tomorrow, rolling periods and custom dates', () => {
  const today = { dateValue: localDate(0).toISOString() };
  const tomorrow = { dateValue: localDate(1).toISOString() };
  const fiveDaysAgo = { dateValue: localDate(-5).toISOString() };
  const twentyDaysAgo = { dateValue: localDate(-20).toISOString() };
  const sixtyDaysAgo = { dateValue: localDate(-60).toISOString() };
  const old = { dateValue: localDate(-120).toISOString() };

  assert.equal(betInAnalyticsRange(today, 'today'), true);
  assert.equal(betInAnalyticsRange(tomorrow, 'today'), false);
  assert.equal(betInAnalyticsRange(tomorrow, 'tomorrow'), true);
  assert.equal(betInAnalyticsRange(today, 'tomorrow'), false);
  assert.equal(betInAnalyticsRange(fiveDaysAgo, '7d'), true);
  assert.equal(betInAnalyticsRange(twentyDaysAgo, '7d'), false);
  assert.equal(betInAnalyticsRange(twentyDaysAgo, '30d'), true);
  assert.equal(betInAnalyticsRange(sixtyDaysAgo, '30d'), false);
  assert.equal(betInAnalyticsRange(sixtyDaysAgo, '90d'), true);
  assert.equal(betInAnalyticsRange(old, '90d'), false);

  const customDay = localDate(-20);
  assert.equal(betInAnalyticsRange(twentyDaysAgo, 'custom', isoDate(customDay), isoDate(customDay)), true);
  assert.equal(betInAnalyticsRange(fiveDaysAgo, 'custom', isoDate(customDay), isoDate(customDay)), false);
});

test('ROI uses only settled stakes and PnL from the selected range', () => {
  const result = calculateSettledReturn([
    { status: 'won', stake: 100, pnl: 80 },
    { status: 'lost', stake: 50, pnl: -50 },
    { status: 'push', stake: 25, pnl: 0 },
    { status: 'pending', stake: 1000, pnl: 999 },
  ]);

  assert.equal(result.settled.length, 3);
  assert.equal(result.totalStake, 175);
  assert.equal(result.totalPnl, 30);
  assert.ok(Math.abs(result.roi - (30 / 175) * 100) < 1e-12);
});

test('changing the selected range changes ROI from that range data', () => {
  const bets = [
    { status: 'won', stake: 100, pnl: 50, dateValue: localDate(0).toISOString() },
    { status: 'lost', stake: 100, pnl: -100, dateValue: localDate(-5).toISOString() },
  ];
  const today = calculateSettledReturn(bets.filter(bet => betInAnalyticsRange(bet, 'today')));
  const sevenDays = calculateSettledReturn(bets.filter(bet => betInAnalyticsRange(bet, '7d')));

  assert.equal(today.roi, 50);
  assert.equal(sevenDays.roi, -25);
});

test('empty and zero-stake ranges have no calculable ROI', () => {
  assert.equal(calculateSettledReturn([]).roi, null);
  assert.equal(calculateSettledReturn([{ status: 'push', stake: 0, pnl: 0 }]).roi, null);
});

test('bankroll return uses selected PnL divided by the saved starting bankroll', () => {
  assert.equal(calculateBankrollReturn(900, 300), 300);
  assert.equal(calculateBankrollReturn(-75, 300), -25);
  assert.equal(calculateBankrollReturn(0, 300), 0);
});

test('bankroll return follows the selected range and requires a positive starting bankroll', () => {
  const bets = [
    { status: 'won', stake: 100, pnl: 90, dateValue: localDate(0).toISOString() },
    { status: 'lost', stake: 100, pnl: -30, dateValue: localDate(-5).toISOString() },
  ];
  const today = calculateSettledReturn(bets.filter(bet => betInAnalyticsRange(bet, 'today')));
  const sevenDays = calculateSettledReturn(bets.filter(bet => betInAnalyticsRange(bet, '7d')));

  assert.equal(calculateBankrollReturn(today.totalPnl, 300), 30);
  assert.equal(calculateBankrollReturn(sevenDays.totalPnl, 300), 20);
  assert.equal(calculateBankrollReturn(10, 0), null);
  assert.equal(calculateBankrollReturn(10, null), null);
  assert.equal(calculateBankrollReturn(10, 'not-a-number'), null);
});

test('daily summaries use local match day and aggregate settled and open bets separately', () => {
  const day = localDate(0);
  const key = localDateKey(day);
  const summaries = buildDailyBetSummaries([
    { status: 'won', stake: 20, pnl: 18, ev: 5, clvOdds: 2.1, clvPct: 3, dateValue: day.toISOString() },
    { status: 'lost', stake: 10, pnl: -10, ev: 3, clvOdds: 2.2, clvPct: -1, dateValue: day.toISOString() },
    { status: 'pending', stake: 15, pnl: 999, ev: 4, clvOdds: null, clvPct: null, dateValue: day.toISOString() },
  ]);
  const summary = summaries.get(key);

  assert.equal(summary.bets, 3);
  assert.equal(summary.settled, 2);
  assert.equal(summary.open, 1);
  assert.equal(summary.totalStake, 45);
  assert.equal(summary.settledStake, 30);
  assert.equal(summary.pnl, 8);
  assert.ok(Math.abs(summary.roi - (8 / 30) * 100) < 1e-12);
  assert.equal(summary.avgEv, 4);
  assert.equal(summary.avgClv, 1);
  assert.equal(summary.clvCount, 2);
});

test('daily summaries ignore missing CLV and fall back to creation time', () => {
  const day = localDate(-2);
  const summary = buildDailyBetSummaries([
    { status: 'pending', stake: 12, ev: 0, clvOdds: null, clvPct: null, createdAt: day.toISOString() },
  ]).get(localDateKey(day));

  assert.equal(summary.avgClv, null);
  assert.equal(summary.clvCount, 0);
  assert.equal(summary.avgEv, 0);
  assert.equal(summary.open, 1);
  assert.equal(summary.pnl, 0);
});
