export function calculateArbitrage(odds, totalStake) {
  const normalizedOdds = odds.map(Number);
  const stake = Number(totalStake);
  if (
    normalizedOdds.length < 2 ||
    normalizedOdds.some((value) => !Number.isFinite(value) || value <= 1) ||
    !Number.isFinite(stake) ||
    stake < 0
  ) {
    return { valid: false, isLocked: false, profitPct: 0, profit: 0, payout: 0, stakes: [] };
  }

  const impliedSum = normalizedOdds.reduce((sum, value) => sum + 1 / value, 0);
  const targetPayout = impliedSum > 0 ? stake / impliedSum : 0;
  const stakes = normalizedOdds.map((value) => Math.round((targetPayout / value) * 100) / 100);
  if (stakes.length && stake > 0) {
    stakes[stakes.length - 1] = Math.max(
      0,
      Math.round((stake - stakes.slice(0, -1).reduce((sum, value) => sum + value, 0)) * 100) / 100,
    );
  }
  const payout = stakes.length
    ? Math.min(...stakes.map((value, index) => value * normalizedOdds[index]))
    : 0;
  const profit = payout - stake;
  return {
    valid: true,
    isLocked: impliedSum < 1,
    impliedSum,
    payout,
    profit,
    profitPct: stake > 0 ? (profit / stake) * 100 : (1 / impliedSum - 1) * 100,
    stakes,
  };
}
