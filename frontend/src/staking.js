export const KELLY_FRACTIONS = [0.25, 0.5, 0.75, 1];
export const DEFAULT_KELLY_FRACTION = 0.5;
export const KELLY_MAX_BET_PCT = 5;

export function normalizeKellyFraction(value) {
  const numeric = Number(value);
  return KELLY_FRACTIONS.includes(numeric) ? numeric : DEFAULT_KELLY_FRACTION;
}

export function formatKellyFraction(value, lang = 'fi') {
  const normalized = normalizeKellyFraction(value);
  const text = normalized === 1 ? normalized.toFixed(1) : String(normalized);
  return lang === 'fi' ? text.replace('.', ',') : text;
}

// Matches Strategy Lab Fractional Kelly with its default zero-stress settings:
// base probability comes from the original offered odds + EV, while Kelly is
// recalculated against the currently displayed (possibly user-edited) odds.
export function calculateKellyStake({
  bankroll,
  originalOdds,
  originalEdgePct,
  effectiveOdds = originalOdds,
  fraction = DEFAULT_KELLY_FRACTION,
  maxBetPct = KELLY_MAX_BET_PCT,
  minStake = 0,
}) {
  const safeBankroll = Math.max(0, Number(bankroll) || 0);
  const safeBankrollCents = Math.max(0, Math.round(safeBankroll * 100));
  const offeredOdds = Number(originalOdds);
  const currentOdds = Number(effectiveOdds);
  const edgePct = Number(originalEdgePct) || 0;
  const safeFraction = normalizeKellyFraction(fraction);

  const baseP = offeredOdds > 1 ? (1 + edgePct / 100) / offeredOdds : 0;
  const modelP = Math.max(0, Math.min(1, baseP));
  const fullKelly = currentOdds > 1
    ? ((modelP * currentOdds) - 1) / (currentOdds - 1)
    : 0;

  let stake = safeBankroll * Math.max(0, fullKelly) * safeFraction;
  const percentageCapEnabled = Number(maxBetPct || 0) > 0;
  const capCents = percentageCapEnabled
    ? Math.floor(safeBankrollCents * Number(maxBetPct) / 100)
    : safeBankrollCents;
  const cap = capCents / 100;
  stake = Math.min(stake, cap, safeBankroll);
  if (stake < Number(minStake || 0)) stake = 0;
  const roundedStake = Number(Math.max(0, stake).toFixed(2));
  return Math.min(roundedStake, cap);
}
