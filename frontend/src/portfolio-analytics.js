const DAY_MS = 864e5;

const ANALYTICS_RANGES = new Set([
  'all',
  'today',
  'tomorrow',
  'yesterday',
  'day_before_yesterday',
  '7d',
  '30d',
  '90d',
  'custom',
]);

export function normalizeAnalyticsRange(value) {
  return ANALYTICS_RANGES.has(value) ? value : '30d';
}

export function parseBetTime(bet) {
  if (bet?.dateValue) {
    const parsed = new Date(bet.dateValue).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  const raw = String(bet?.date || '');
  const fi = raw.match(/^(\d{1,2})\.(\d{1,2})\.\s*(?:(\d{1,2})[.:](\d{2}))?/);
  if (fi) {
    const year = new Date().getFullYear();
    const parsed = new Date(
      year,
      Number(fi[2]) - 1,
      Number(fi[1]),
      Number(fi[3] || 0),
      Number(fi[4] || 0),
    ).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  const created = new Date(bet?.createdAt).getTime();
  return Number.isFinite(created) ? created : null;
}

function dayBounds(offsetDays) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);
  return [start.getTime(), start.getTime() + DAY_MS - 1];
}

export function betInAnalyticsRange(bet, range, from, to) {
  if (range === 'all') return true;
  const time = parseBetTime(bet);
  if (!Number.isFinite(time)) return true;
  const now = Date.now();
  if (range === 'today') {
    const [start, end] = dayBounds(0);
    return time >= start && time <= end;
  }
  if (range === 'tomorrow') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return time >= start.getTime() && time < end.getTime();
  }
  if (range === 'yesterday') {
    const [start, end] = dayBounds(-1);
    return time >= start && time <= end;
  }
  if (range === 'day_before_yesterday') {
    const [start, end] = dayBounds(-2);
    return time >= start && time <= end;
  }
  if (range === '7d') return time >= now - 7 * DAY_MS && time <= now;
  if (range === '30d') return time >= now - 30 * DAY_MS && time <= now;
  if (range === '90d') return time >= now - 90 * DAY_MS && time <= now;
  if (range === 'custom') {
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : null;
    return (!Number.isFinite(fromTime) || time >= fromTime)
      && (!Number.isFinite(toTime) || time <= toTime);
  }
  return true;
}

export function isSettledBet(bet) {
  return bet?.status !== 'pending';
}

export function calculateSettledReturn(bets = []) {
  const settled = bets.filter(isSettledBet);
  const totalStake = settled.reduce((sum, bet) => sum + (Number(bet.stake) || 0), 0);
  const totalPnl = settled.reduce((sum, bet) => sum + (Number(bet.pnl) || 0), 0);
  return {
    settled,
    totalStake,
    totalPnl,
    roi: totalStake > 0 ? (totalPnl / totalStake) * 100 : null,
  };
}
