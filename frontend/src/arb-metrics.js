export function applyArbCorrections(legs, corrections) {
  const latest = new Map();
  const counts = new Map();
  for (const correction of corrections || []) {
    const key = String(correction.leg_id);
    counts.set(key, (counts.get(key) || 0) + 1);
    const previous = latest.get(key);
    if (!previous || Date.parse(correction.created_at) > Date.parse(previous.created_at) ||
      (correction.created_at === previous.created_at && String(correction.id) > String(previous.id))) {
      latest.set(key, correction);
    }
  }
  return (legs || []).map(leg => {
    const correction = latest.get(String(leg.id));
    if (!correction) return { ...leg, correctionCount: 0, effectiveCorrectionId: null };
    return {
      ...leg,
      actual_book: correction.actual_book,
      actual_odds: correction.actual_odds,
      actual_stake: correction.actual_stake,
      result: correction.result ?? leg.result,
      returned_amount: correction.returned_amount ?? leg.returned_amount,
      correctionCount: counts.get(String(leg.id)),
      effectiveCorrectionId: correction.id,
    };
  });
}

export function arbAttemptMetrics(attempts, legs) {
  const started = attempts.filter(a => a.started_at);
  const allPlaced = started.filter(a => {
    const own = legs.filter(l => l.attempt_id === a.id);
    return own.length >= 2 && own.every(l => ['placed', 'settled'].includes(l.status));
  });
  const durations = allPlaced.map(a => {
    const placed = legs.filter(l => l.attempt_id === a.id && l.placed_at);
    return (Math.max(...placed.map(l => Date.parse(l.placed_at))) - Date.parse(a.started_at)) / 1000;
  }).filter(n => Number.isFinite(n) && n >= 0);
  const settled = legs.filter(l => l.status === 'settled');
  const placed = legs.filter(l => ['placed', 'settled'].includes(l.status));
  const oddsChanges = placed.map(l => (Number(l.actual_odds) / Number(l.offered_odds) - 1) * 100)
    .filter(Number.isFinite);
  return {
    started: started.length,
    fullyPlaced: allPlaced.length,
    successPct: started.length ? 100 * allPlaced.length / started.length : null,
    averageSeconds: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    settledLegs: settled.length,
    realizedPnl: settled.reduce((sum, l) => sum + Number(l.returned_amount || 0) - Number(l.actual_stake || 0), 0),
    partialWithStake: started.filter(a => {
      const own = legs.filter(l => l.attempt_id === a.id);
      return own.some(l => ['placed', 'settled'].includes(l.status)) &&
        own.some(l => !['placed', 'settled'].includes(l.status));
    }).length,
    rejectedWithoutTimer: attempts.filter(a => a.status === 'rejected' && !a.started_at).length,
    averageOddsChangePct: oddsChanges.length
      ? oddsChanges.reduce((a, b) => a + b, 0) / oddsChanges.length : null,
  };
}

export function arbPlacedScenario(legs) {
  if (legs.length < 2 || legs.length > 3 ||
    legs.some(l => !['placed', 'settled'].includes(l.status) ||
      !(Number(l.actual_stake) > 0) || !(Number(l.actual_odds) > 1))) return null;
  const totalStake = legs.reduce((sum, l) => sum + Number(l.actual_stake), 0);
  const minPayout = Math.min(...legs.map(l => Number(l.actual_stake) * Number(l.actual_odds)));
  return { totalStake, minPayout, theoreticalWorstPnl: minPayout - totalStake };
}

export function arbOfferTermsChanged(snapshot, current) {
  if (!snapshot || !current) return false;
  if (snapshot.arb_key && current.arbKey)
    return String(snapshot.arb_key) !== String(current.arbKey);
  const oldLegs = Array.isArray(snapshot.outcomes_json) ? snapshot.outcomes_json : [];
  const newLegs = Array.isArray(current.legs) ? current.legs : [];
  if (!oldLegs.length || !newLegs.length) return false;
  const signature = rows => rows.map(row => [
    String(row.outcome ?? row.kohde ?? row.side ?? '').trim().toLowerCase(),
    String(row.book ?? row.kirja ?? '').trim().toLowerCase(),
    Number(row.odds ?? row.kerroin),
  ]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify(signature(oldLegs)) !== JSON.stringify(signature(newLegs));
}

export function describeArbOfferChange(snapshot, current) {
  const oldLegs = Array.isArray(snapshot?.outcomes_json) ? snapshot.outcomes_json : [];
  const newLegs = Array.isArray(current?.legs) ? current.legs : [];
  const oldByOutcome = new Map(oldLegs.map(leg => [
    String(leg.outcome ?? leg.kohde ?? leg.side ?? '').trim().toLowerCase(), leg,
  ]));
  const changes = [];
  for (const next of newLegs) {
    const key = String(next.outcome ?? '').trim().toLowerCase();
    const old = oldByOutcome.get(key);
    if (!key || !old) return ['Jalkojen kohdistusta ei voi varmistaa automaattisesti.'];
    const oldBook = String(old.book ?? old.kirja ?? '');
    const oldOdds = Number(old.odds ?? old.kerroin);
    if (oldBook !== next.book || oldOdds !== Number(next.odds))
      changes.push(`${next.outcome}: ${oldBook || '?'} @ ${Number.isFinite(oldOdds) ? oldOdds.toFixed(2) : '?'} → ${next.book} @ ${Number(next.odds).toFixed(2)}`);
  }
  if (newLegs.length !== oldLegs.length) return ['Jalkojen lukumäärä muuttui.'];
  return changes.length ? changes : ['Jalkojen kirjat ja kertoimet näyttävät samoilta; tarkista silti ehdot.'];
}
