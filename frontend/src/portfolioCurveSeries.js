export function buildPortfolioCurveSeries(bets) {
  const actual = [0];
  const ev = [0];
  const clv = [0];
  let evRows = 0;
  let clvRows = 0;

  (Array.isArray(bets) ? bets : []).forEach(bet => {
    const stakeValue = bet?.stake === '' || bet?.stake === null || bet?.stake === undefined ? NaN : Number(bet.stake);
    const pnlValue = bet?.pnl === '' || bet?.pnl === null || bet?.pnl === undefined ? NaN : Number(bet.pnl);
    const evPct = bet?.ev === '' || bet?.ev === null || bet?.ev === undefined ? NaN : Number(bet.ev);
    const clvPct = bet?.clvPct === '' || bet?.clvPct === null || bet?.clvPct === undefined ? NaN : Number(bet.clvPct);
    const stake = Number.isFinite(stakeValue) ? stakeValue : 0;
    const pnl = Number.isFinite(pnlValue) ? pnlValue : 0;
    actual.push(actual[actual.length - 1] + pnl);
    const hasEv = Number.isFinite(evPct);
    ev.push(ev[ev.length - 1] + (hasEv ? stake * evPct / 100 : 0));
    if (hasEv) evRows += 1;
    const hasClv = bet?.clvUsable === true && Number.isFinite(clvPct);
    clv.push(clv[clv.length - 1] + (hasClv ? stake * clvPct / 100 : 0));
    if (hasClv) clvRows += 1;
  });
  return { actual, ev, clv, evRows, clvRows };
}
