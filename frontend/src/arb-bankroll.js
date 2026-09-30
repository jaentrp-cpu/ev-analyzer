const cents = (value) => Math.round(Number(value || 0) * 100);

// Only recorded returns count as profit. Transfers between books are irrelevant.
export function arbBankroll(attempts, legs, opening = 0) {
  const ids = new Set(attempts.filter((a) => !a.deleted_at).map((a) => a.id));
  const active = legs.filter((l) => ids.has(l.attempt_id));
  let pnl = 0,
    committed = 0;
  const events = [];
  for (const leg of active) {
    if (leg.status === "placed") committed += cents(leg.actual_stake);
    if (leg.status !== "settled") continue;
    const delta = cents(leg.returned_amount) - cents(leg.actual_stake);
    pnl += delta;
  }
  // Plot a completed attempt as one net result, not a temporary winning-leg
  // spike followed by the other leg's loss.
  for (const attempt of attempts.filter((a) => !a.deleted_at)) {
    const own = active.filter((l) => l.attempt_id === attempt.id);
    const settled = own.filter((l) => l.status === "settled");
    if (
      !settled.length ||
      own.some(
        (l) =>
          l.status === "placed" ||
          (l.status === "pending" &&
            ["started", "partial"].includes(attempt.status)),
      )
    )
      continue;
    const times = settled.map((l) => Date.parse(l.settled_at || ""));
    if (times.some((t) => !Number.isFinite(t))) continue;
    events.push({
      at: Math.max(...times),
      id: attempt.id,
      delta: settled.reduce(
        (sum, l) => sum + cents(l.returned_amount) - cents(l.actual_stake),
        0,
      ),
    });
  }
  events.sort(
    (a, b) => a.at - b.at || String(a.id).localeCompare(String(b.id)),
  );
  let cumulative = 0;
  const curve = events.map((e) => ({
    ...e,
    pnl: (cumulative += e.delta) / 100,
  }));
  return {
    pnl: pnl / 100,
    committed: committed / 100,
    total: (cents(opening) + pnl) / 100,
    available: (cents(opening) + pnl - committed) / 100,
    curve,
    partialPnl: (pnl - cumulative) / 100,
    unverifiedReturns: active.filter(
      (l) => l.status === "settled" && l.net_return_verified !== true,
    ).length,
    missingResultTimes: active.filter(
      (l) =>
        l.status === "settled" &&
        !Number.isFinite(Date.parse(l.settled_at || "")),
    ).length,
  };
}

export function arbTiming(attempt, legs) {
  const start = Date.parse(attempt.started_at || "");
  const observed = Date.parse(attempt.source_updated_at || "");
  return legs.map((l) => {
    const placed = Date.parse(l.checked_at || l.placed_at || "");
    return {
      ...l,
      attemptSeconds:
        Number.isFinite(start) && Number.isFinite(placed) && placed >= start
          ? (placed - start) / 1000
          : null,
      observationSeconds:
        Number.isFinite(observed) &&
        Number.isFinite(placed) &&
        placed >= observed
          ? (placed - observed) / 1000
          : null,
      sameOdds:
        Number(l.actual_odds) > 1
          ? Number(l.actual_odds) === Number(l.offered_odds)
          : null,
    };
  });
}
