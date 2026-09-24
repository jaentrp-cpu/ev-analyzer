import { sbClient } from './supabase.js';
import { loadPagedRows } from './userBetsPagination.js';
import { applyArbCorrections } from './arb-metrics.js';
export { arbAttemptMetrics } from './arb-metrics.js';

function check({ error, data }) {
  if (error) throw error;
  return data;
}

export async function loadArbTracker() {
  const [attempts, legs, corrections, wallets, cashEntries, consent] = await Promise.all([
    loadPagedRows((from, to) => sbClient.from('user_arb_attempts')
      .select('*').order('created_at', { ascending: false })
      .order('id', { ascending: false }).range(from, to)),
    loadPagedRows((from, to) => sbClient.from('user_arb_legs')
      .select('*').order('id').range(from, to)),
    loadPagedRows((from, to) => sbClient.from('user_arb_leg_corrections')
      .select('*').order('created_at', { ascending: false })
      .order('id', { ascending: false }).range(from, to)),
    sbClient.from('user_arb_wallets').select('*').order('bookmaker'),
    sbClient.from('user_arb_cash_entries')
      .select('id,bookmaker,kind,amount,note,operation_id,balance_after,created_at')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50),
    sbClient.from('user_arb_analytics_consent').select('founder_aggregate_opt_in').maybeSingle(),
  ]);
  return {
    attempts: check(attempts) || [],
    legs: applyArbCorrections(check(legs) || [], check(corrections) || []),
    corrections: check(corrections) || [],
    wallets: check(wallets) || [],
    cashEntries: check(cashEntries) || [],
    consent: check(consent)?.founder_aggregate_opt_in === true,
  };
}

export async function createArbAttempt(offerId, expectedUpdatedAt, rejectReason = null, previousAttemptId = null) {
  return check(await sbClient.rpc('arb_create_attempt', {
    p_offer_id: offerId, p_expected_updated_at: expectedUpdatedAt,
    p_reject_reason: rejectReason, p_previous_attempt: previousAttemptId,
  }));
}

export async function openArbWallet(book, amount) {
  return check(await sbClient.rpc('arb_set_opening_balance', { p_book: book, p_amount: amount }));
}

export async function adjustArbWallet(book, kind, amount, reason) {
  return check(await sbClient.rpc('arb_adjust_wallet', {
    p_book: book, p_kind: kind, p_amount: amount, p_reason: reason,
    p_request_id: crypto.randomUUID(),
  }));
}

export async function transferArbWallet(fromBook, toBook, amount, reason) {
  return check(await sbClient.rpc('arb_transfer_wallet', {
    p_from_book: fromBook, p_to_book: toBook, p_amount: amount, p_reason: reason,
    p_request_id: crypto.randomUUID(),
  }));
}

export async function placeArbLeg(legId, book, odds, stake) {
  return check(await sbClient.rpc('arb_place_leg', {
    p_leg_id: legId, p_book: book, p_odds: odds, p_stake: stake,
  }));
}

export async function markArbLegUnavailable(legId, reason, actualOdds = null) {
  return check(await sbClient.rpc('arb_mark_leg_unavailable', {
    p_leg_id: legId, p_reason: reason, p_actual_odds: actualOdds,
  }));
}

export async function settleArbLeg(legId, result) {
  return check(await sbClient.rpc('arb_settle_leg', { p_leg_id: legId, p_result: result }));
}

export async function correctArbLeg(legId, reason, book, odds, stake, result = null) {
  return check(await sbClient.rpc('arb_correct_leg', {
    p_leg_id: legId, p_reason: reason, p_book: book,
    p_odds: odds, p_stake: stake, p_result: result,
  }));
}

export async function closeArbAttempt(attemptId, reason) {
  return check(await sbClient.rpc('arb_close_attempt', {
    p_attempt_id: attemptId, p_reason: reason,
  }));
}

export async function setArbAnalyticsConsent(optIn) {
  return check(await sbClient.rpc('arb_set_analytics_consent', { p_opt_in: Boolean(optIn) }));
}
