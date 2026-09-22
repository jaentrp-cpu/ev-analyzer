export function buildPortfolioCurveSeries(bets) {
  const actual = [0];
  const ev = [0];
  const clv = [0];
  let evRows = 0;
  let clvRows = 0;

  (bets || []).forEach(bet => {
    const stake = Number(bet?.stake) || 0;
    const pnl = Number(bet?.pnl) || 0;
    const evPct = Number(bet?.ev);
    const clvPct = Number(bet?.clvPct);
    actual.push(actual[actual.length - 1] + pnl);
    const hasEv = bet?.ev !== null && bet?.ev !== undefined && Number.isFinite(evPct);
    ev.push(ev[ev.length - 1] + (hasEv ? stake * evPct / 100 : 0));
    if (hasEv) evRows += 1;
    const hasClv = bet?.clvUsable === true && Number.isFinite(clvPct);
    clv.push(clv[clv.length - 1] + (hasClv ? stake * clvPct / 100 : 0));
    if (hasClv) clvRows += 1;
  });
  return { actual, ev, clv, evRows, clvRows };
}
