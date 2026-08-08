// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Vedox - Supabase client + auth helpers
// Uses only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FINNISH_TIME_ZONE = 'Europe/Helsinki';

export const sbClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// â”€â”€â”€ Tier â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const TIER_META = {
  none:         { label: '',          pages: [] },
  rookie_value: { label: 'Rookie',    pages: ['value', 'mybets'] },
  rookie_sure:  { label: 'Rookie',    pages: ['sure',  'mybets'] },
  pro_value:    { label: 'Pro',       pages: ['value', 'mybets', 'analytics'] },
  pro_sure:     { label: 'Pro',       pages: ['sure',  'mybets', 'analytics'] },
  all_star:     { label: 'All-Star',  pages: ['value', 'sure', 'mybets', 'analytics'] },
};
export const PUBLIC_PAGES = new Set(['home', 'guides', 'news']);

export function normalizeTier(code) {
  return Object.prototype.hasOwnProperty.call(TIER_META, code) ? code : 'none';
}
export function tierLabel(code) {
  return TIER_META[normalizeTier(code)].label;
}
export function canAccess(tierCode, pageId) {
  if (PUBLIC_PAGES.has(pageId)) return true;
  return TIER_META[normalizeTier(tierCode)].pages.includes(pageId);
}

export function steamGradeFromScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  if (n >= 85) return 'A+';
  if (n >= 75) return 'A-';
  if (n >= 65) return 'B+';
  if (n >= 55) return 'B-';
  if (n >= 45) return 'C+';
  if (n >= 35) return 'C-';
  return 'D';
}

export function formatSteamScore100(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '-';
  return `${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)}/100`;
}

function parseJsonMaybe(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function steamInfoFromRow(row) {
  const signal = parseJsonMaybe(row?.signal_json);
  const rating = parseJsonMaybe(
    signal.steam_rating_current ?? signal.steam_rating_v1 ?? signal.steam_rating_v0
  );
  const ratingSource = String(
    rating.steam_rating_source ?? signal.steam_rating_source ?? ''
  ).trim();
  const ratingModelVersion = String(
    rating.steam_rating_model_version ?? signal.steam_rating_model_version ?? ''
  ).trim();
  const isV1Contract =
    ratingModelVersion === 'steam_rating_v1_edge_shadow_2026_07_27';
  const isV1Unscorable =
    isV1Contract && ratingSource === 'unscorable_input_error';
  const learnedScore = parseFloat(
    rating.steam_rating_value_num ?? signal.steam_rating_value_num
  );
  const validLearnedScore = ratingSource === 'steam_rating_rules'
    && Number.isFinite(learnedScore)
    && learnedScore >= 0
    && learnedScore <= 100;
  const legacyScore = parseFloat(
    row?.steam_quality_score ?? signal.steam_quality_score ?? signal.steam_candidate_score
  );
  const normalizedLegacyScore = Number.isFinite(legacyScore)
    ? Math.max(0, Math.min(100, (legacyScore / 58) * 100))
    : null;
  const edge = parseFloat(row?.steam_edge_pct ?? signal.steam_edge_pct);
  const marker = String(signal.ev_marker || signal.wimbledon_reference_marker || '').trim();
  const matchLevel = validLearnedScore
    ? String(rating.steam_rating_match_level ?? signal.steam_rating_match_level ?? '').trim()
    : '';
  const matchLabel = {
    exact: ratingModelVersion === 'steam_rating_v1_edge_shadow_2026_07_27'
      ? 'tarkka alert-time-malli'
      : 'tarkka sääntö',
    ref_segment: 'referenssiryhmä',
    edge_segment: 'aika- ja eturyhmä',
    time_segment: 'aikaryhmä',
    range_segment: 'yleinen sääntö',
  }[matchLevel] || '';
  const learnedGrade = String(
    rating.steam_rating ?? signal.steam_rating ?? ''
  ).trim().toUpperCase();
  const labels = parseFloat(rating.steam_rating_labels ?? signal.steam_rating_labels);
  const avgClv = parseFloat(rating.steam_rating_avg_clv ?? signal.steam_rating_avg_clv);
  const badClvPct = parseFloat(
    rating.steam_rating_bad_clv_pct ?? signal.steam_rating_bad_clv_pct
  );
  const ruleValue = parseFloat(
    rating.steam_rating_rule_value_num ?? signal.steam_rating_rule_value_num
  );
  const liveAdjustment = parseFloat(
    rating.steam_rating_live_adjustment ?? signal.steam_rating_live_adjustment
  );
  const evidenceLevel = validLearnedScore
    ? String(
      rating.steam_rating_evidence_level ?? signal.steam_rating_evidence_level ?? ''
    ).trim()
    : '';
  const individualization = validLearnedScore
    ? String(
      rating.steam_rating_individualization ?? signal.steam_rating_individualization ?? ''
    ).trim()
    : '';
  const modelFingerprint = String(
    rating.steam_rating_model_fingerprint ??
      signal.steam_rating_model_fingerprint ??
      ''
  ).trim();
  const displayScore = validLearnedScore
    ? learnedScore
    : isV1Unscorable ? null : normalizedLegacyScore;
  const displaySource = validLearnedScore
    ? 'steam_rating_rules'
    : isV1Unscorable
      ? 'unscorable_input_error'
      : Number.isFinite(normalizedLegacyScore) ? 'legacy_quality_normalized' : '';
  return {
    steamScore: validLearnedScore ? learnedScore : null,
    steamGrade: validLearnedScore && ['A', 'B', 'C', 'D'].includes(learnedGrade)
      ? learnedGrade
      : validLearnedScore ? steamGradeFromScore(learnedScore) : null,
    steamSource: validLearnedScore ? ratingSource : '',
    steamModelVersion: ratingModelVersion,
    steamModelFingerprint: modelFingerprint,
    steamUnscorable: isV1Unscorable,
    steamMatchLevel: matchLevel,
    steamMatchLabel: matchLabel,
    steamLabels: Number.isFinite(labels) ? labels : null,
    steamAvgClv: Number.isFinite(avgClv) ? avgClv : null,
    steamBadClvPct: Number.isFinite(badClvPct) ? badClvPct : null,
    steamConfidence: validLearnedScore
      ? String(rating.steam_rating_confidence ?? signal.steam_rating_confidence ?? '').trim()
      : '',
    steamRuleValue: Number.isFinite(ruleValue) ? ruleValue : null,
    steamLiveAdjustment: Number.isFinite(liveAdjustment) ? liveAdjustment : null,
    steamEvidenceLevel: evidenceLevel,
    steamIndividualization: individualization,
    legacySteamScore: Number.isFinite(legacyScore) ? legacyScore : null,
    legacySteamNormalizedScore: normalizedLegacyScore,
    steamDisplayScore: displayScore,
    steamDisplayGrade: Number.isFinite(displayScore)
      ? validLearnedScore && ['A', 'B', 'C', 'D'].includes(learnedGrade)
        ? learnedGrade
        : steamGradeFromScore(displayScore)
      : null,
    steamDisplaySource: displaySource,
    steamDisplayLabel: validLearnedScore
      ? (matchLabel || 'opittu sääntö')
      : isV1Unscorable
        ? 'puuttuva mallisyöte'
        : Number.isFinite(normalizedLegacyScore) ? 'reaaliaikainen 0–58' : '',
    steamEdgePct: Number.isFinite(edge) ? edge : null,
    evMarker: marker === '@' || marker === '!' ? marker : '',
  };
}

function isPublicValueBet(row) {
  const odds = Number(row?.odds || 0);
  const edge = Number(row?.edge || 0);
  return edge >= 3 && edge <= 8 && odds >= 1.8 && odds <= 2.5;
}

// â”€â”€â”€ Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function loadProfile(user) {
  const { data, error } = await sbClient
    .from('profiles')
    .select('username, avatar_url, tier_code')
    .eq('id', user.id)
    .maybeSingle();
  if (error) console.warn('[Vedox] profile load failed:', error.message);
  const fallback = user.email.split('@')[0];
  return {
    username:   data?.username   || fallback,
    avatar_url: data?.avatar_url || null,
    tier_code:  normalizeTier(data?.tier_code || 'none'),
  };
}

// â”€â”€â”€ User settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function loadUserSettings(userId) {
  let { data, error } = await sbClient
    .from('user_settings')
    .select('bankroll, flat_stake, stake_pct, stake_mode, kelly_fraction, lang, theme')
    .eq('user_id', userId)
    .maybeSingle();
  if (error && /stake_mode|kelly_fraction|column|schema cache|does not exist/i.test(error.message || '')) {
    const fallback = await sbClient
      .from('user_settings')
      .select('bankroll, flat_stake, stake_pct, lang, theme')
      .eq('user_id', userId)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) console.warn('[Vedox] user_settings load failed:', error.message);
  return data || null;
}

export async function saveUserSettings(userId, patch) {
  const { data, error } = await sbClient
    .from('user_settings')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
    .select('user_id')
    .maybeSingle();
  if (error) {
    console.warn('[Vedox] user_settings save failed:', error.message);
    throw error;
  }
  if (data?.user_id !== userId) {
    const confirmationError = new Error('user_settings write was not confirmed');
    console.warn('[Vedox] user_settings save failed:', confirmationError.message);
    throw confirmationError;
  }
  return data;
}

// â”€â”€â”€ EV Bets â€” vain value-oikeudella â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function fetchEvBets(tierCode) {
  if (!canAccess(tierCode, 'value')) return [];
  const coreSelect = 'id, ottelu, alkaa, markkina, kohde, paras_kerroin, kirja, ev_pct, liiga';
  const steamSelect = `${coreSelect}, steam_quality_score, steam_edge_pct, signal_json`;
  let { data, error } = await sbClient
    .from('ev_bets')
    .select(steamSelect)
    .eq('aktiivinen', true)
    .order('ev_pct', { ascending: false });
  if (error && /steam_|signal_json|column|schema cache|does not exist/i.test(error.message || '')) {
    const fallback = await sbClient
      .from('ev_bets')
      .select(coreSelect)
      .eq('aktiivinen', true)
      .order('ev_pct', { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }
  if (error) { console.warn('[Vedox] ev_bets load failed:', error.message); return []; }
  return (data || []).map(r => {
    const steam = steamInfoFromRow(r);
    return {
      id:       String(r.id),
      match:    r.ottelu   || '',
      startsAt: r.alkaa,
      market:   r.markkina || '',
      outcome:  r.kohde    || '',
      odds:     parseFloat(r.paras_kerroin) || 0,
      book:     normalizeBookName(r.kirja),
      edge:     parseFloat(r.ev_pct)        || 0,
      liiga:    r.liiga    || '',
      clvOdds:  null,
      clvPct:   null,
      clvCheckedAt: null,
      clvSource:    '',
      ...steam,
    };
  }).filter(isPublicValueBet);
}

// â”€â”€â”€ Arbitrages â€” vain sure-oikeudella â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function fetchArbitrages(tierCode) {
  if (!canAccess(tierCode, 'sure')) return [];
  const { data, error } = await sbClient
    .from('arbitrages')
    .select('*')
    .eq('aktiivinen', true)
    .order('profit_pct', { ascending: false });
  if (error) { console.warn('[Vedox] arbitrages load failed:', error.message); return []; }
  return (data || []).map(a => {
    let outcomes = [];
    if (Array.isArray(a.outcomes_json)) outcomes = a.outcomes_json;
    else if (typeof a.outcomes_json === 'string') {
      try { outcomes = JSON.parse(a.outcomes_json); } catch { outcomes = []; }
    }
    return {
      id:       String(a.id),
      match:    a.ottelu || '',
      league:   formatLeague(a.liiga) || a.liiga || '',
      market:   a.markkina || a.market || 'h2h',
      startsAt: a.alkaa,
      profit:   parseFloat(a.profit_pct) || 0,
      legs:     outcomes.map(o => ({
        outcome: o.outcome || o.kohde  || '',
        book:    normalizeBookName(o.book || o.kirja),
        odds:    parseFloat(o.odds   || o.kerroin) || 0,
        share:   parseFloat(o.share  || o.osuus)   || 0,
        market:  a.markkina || a.market || 'h2h',
      })),
    };
  });
}

// â”€â”€â”€ User bets â€” vain kirjautuneelle + mybets-oikeudella â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const USER_BETS_MIGRATION_CUTOFF = '2026-05-21T21:25:00.000Z';

function fiDateParts(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('fi-FI', {
    timeZone: FINNISH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return parts;
}

function fiDateInputValue(value) {
  const parts = fiDateParts(value);
  if (!parts) return '';
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function fiDateKey(value) {
  const parts = fiDateParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
}

function formatBetDate(value) {
  if (!value) return new Date().toLocaleDateString('fi-FI', { day: '2-digit', month: 'numeric' });
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('fi-FI', { day: '2-digit', month: 'numeric', timeZone: FINNISH_TIME_ZONE });
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatBetDateTime(value) {
  if (!value) return formatBetDate(value);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const hasTime = !/^\d{4}-\d{2}-\d{2}$/.test(String(value));
  const date = d.toLocaleDateString('fi-FI', { day: '2-digit', month: 'numeric', timeZone: FINNISH_TIME_ZONE });
  if (!hasTime) return date;
  const parts = fiDateParts(d);
  return `${date} ${parts.hour}.${parts.minute}`;
}

function toDateTimeInputValue(value) {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/.test(raw)) return fiDateInputValue(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00`;
  const fiMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.\s*(?:(\d{1,2})[.:](\d{2}))?/);
  if (fiMatch) {
    const year = new Date().getFullYear();
    const day = pad2(fiMatch[1]);
    const month = pad2(fiMatch[2]);
    const hour = pad2(fiMatch[3] || 0);
    const minute = pad2(fiMatch[4] || 0);
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return fiDateInputValue(d);
}

export function clvPhaseFromSource(source) {
  const normalized = String(source || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!normalized) return '';
  if (normalized.includes('historical')) return 'historical';
  if (
    normalized.includes('closing')
    || normalized.includes('final')
    || normalized.includes('settled')
  ) return 'closing';
  if (
    normalized.includes('prestart')
    || normalized.includes('pre_start')
  ) return 'prestart';
  if (normalized.includes('latest_reference')) return 'latest_reference';
  if (normalized.includes('signal_open')) return 'signal_open';
  return '';
}

export function isTrustedClvTiming(phase, checkedAt, startsAt) {
  if (!['closing', 'prestart', 'historical'].includes(phase)) return false;
  const checkedMs = new Date(checkedAt || 0).getTime();
  const startsMs = new Date(startsAt || 0).getTime();
  if (!Number.isFinite(checkedMs) || !Number.isFinite(startsMs) || checkedMs > startsMs) {
    return false;
  }
  const earliestMs = phase === 'prestart'
    ? startsMs - 40 * 60 * 1000
    : startsMs - 5 * 60 * 1000;
  return checkedMs >= earliestMs;
}

function normalizedClvContractValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized || null;
}

function clvObservationMatchesSource(observation, source) {
  if (!observation || !source) return false;
  if (normalizedClvContractValue(observation.reference_book) !== 'pinnacle') return false;
  const referenceOdds = Number(observation.reference_odds);
  if (!(referenceOdds > 1)) return false;
  if (String(observation.ev_bet_id || '') !== String(source.id || '')) return false;

  const observationEventId = normalizedClvContractValue(observation.event_id);
  const sourceEventId = normalizedClvContractValue(source.event_id);
  const observationStableKey = normalizedClvContractValue(observation.stable_event_key);
  const sourceStableKey = normalizedClvContractValue(source.stable_event_key);
  if (observationEventId) {
    if (!sourceEventId || observationEventId !== sourceEventId) return false;
  } else if (!observationStableKey || observationStableKey !== sourceStableKey) {
    return false;
  }
  if (observationStableKey && observationStableKey !== sourceStableKey) return false;

  const marketKey = normalizedClvContractValue(observation.market_key);
  const selectionKey = normalizedClvContractValue(observation.selection_key);
  if (!marketKey || marketKey !== normalizedClvContractValue(source.market_key)) return false;
  if (!selectionKey || selectionKey !== normalizedClvContractValue(source.selection_key)) return false;
  if (marketKey !== 'h2h') {
    const lineKey = normalizedClvContractValue(observation.line_key);
    if (!lineKey || lineKey !== normalizedClvContractValue(source.line_key)) return false;
  }

  const phase = clvPhaseFromSource(observation.observation_type);
  return isTrustedClvTiming(phase, observation.observed_at, source.alkaa);
}

function dbBetToLocal(row) {
  const odds  = parseFloat(row.odds)  || 0;
  const stake = parseFloat(row.stake) || 0;
  const storedEv = row.ev === undefined || row.ev === null ? null : parseFloat(row.ev);
  const storedReturnedAmount = row.returned_amount === undefined || row.returned_amount === null
    ? null
    : parseFloat(row.returned_amount);
  const ownClvOdds = row.clv_odds === undefined || row.clv_odds === null ? null : parseFloat(row.clv_odds);
  const sourceClvOdds = row.source_clv_odds === undefined || row.source_clv_odds === null ? null : parseFloat(row.source_clv_odds);
  const hasOwnClv = Number.isFinite(ownClvOdds) && ownClvOdds > 0;
  const hasSourceClv = Number.isFinite(sourceClvOdds) && sourceClvOdds > 0;
  const ownClvSource = hasOwnClv ? String(row.clv_source || 'historical_stored') : '';
  const sourceClvSource = hasSourceClv ? String(row.source_clv_source || 'source') : '';
  // A stored user_bets.clv_* value without an exact source observation belongs
  // to the historical series even if its old source label looked like closing.
  const ownClvPhase = hasOwnClv ? 'historical' : '';
  const sourceClvPhase = clvPhaseFromSource(sourceClvSource);
  // source_clv_* is populated only after the exact source/observation contract
  // has been validated. A legacy user_bets.clv_* value is not independently
  // auditable, so it must never outrank a validated source observation.
  const useSourceClv = hasSourceClv;
  const clvOdds = useSourceClv ? sourceClvOdds : (hasOwnClv ? ownClvOdds : null);
  const clvSource = useSourceClv ? sourceClvSource : ownClvSource;
  const clvPhase = useSourceClv ? sourceClvPhase : ownClvPhase;
  const clvPct = Number.isFinite(clvOdds) && clvOdds > 0 && odds > 0
    ? ((odds / clvOdds) - 1) * 100
    : null;
  const steam = steamInfoFromRow(row);
  const settled = row.settled === true;
  const result = settled && ['won', 'lost', 'push', 'half_won', 'half_lost'].includes(row.result) ? row.result : 'pending';
  const pnl = result === 'won'  ? (odds - 1) * stake
             : result === 'lost' ? -stake
             : result === 'push' ? 0
             : result === 'half_won' ? ((odds - 1) * stake) / 2
             : result === 'half_lost' ? -(stake / 2)
             : null;
  return {
    _dbId:        row.id,
    createdAt:    row.created_at,
    date:         formatBetDateTime(row.date),
    dateValue:    toDateTimeInputValue(row.date),
    match:        row.match           || '',
    outcome:      row.target          || '',
    book:         normalizeBookName(row.book),
    odds,
    stake,
    ev:           Number.isFinite(storedEv) ? storedEv : 0,
    storedEv:     Number.isFinite(storedEv) ? storedEv : null,
    storedReturnedAmount: Number.isFinite(storedReturnedAmount) ? storedReturnedAmount : null,
    storedResult: row.result ?? null,
    storedSettled: typeof row.settled === 'boolean' ? row.settled : null,
    estimate:     0,
    status:       result,
    settled,
    returnAmount: parseFloat(row.returned_amount) || 0,
    market:       row.market          || '',
    aalto:        row.aalto           || '',
    liiga:        row.liiga           || '',
    sport:        row.sport           || '',
    league:       row.league          || '',
    taxonomyStatus: row.taxonomy_status || row.taxonomyStatus || '',
    taxonomyReason: row.taxonomy_reason || row.taxonomyReason || '',
    sourceBetId:  row.source_bet_id   ? String(row.source_bet_id) : null,
    clvOdds:      Number.isFinite(clvOdds) ? clvOdds : null,
    clvPct:       Number.isFinite(clvPct) ? clvPct : null,
    clvCheckedAt: useSourceClv ? (row.source_clv_checked_at || null) : (hasOwnClv ? (row.clv_checked_at || null) : null),
    clvStartsAt: row.source_starts_at || row.date || null,
    clvSource,
    clvPhase,
    clvVerified: useSourceClv,
    clvFallbackSource: useSourceClv ? 'source' : '',
    bettorName:   row.bettor_name     || '',
    ...steam,
    autoResultCheckedAt: row.auto_result_checked_at || null,
    autoResultSource:    row.auto_result_source || '',
    pnl,
  };
}

function clvObservationRank(type) {
  return type === 'closing_reference' ? 2 : type === 'pre_start_reference' ? 1 : 0;
}

function isBetterClvObservation(candidate, current) {
  if (!current) return true;
  const candidateRank = clvObservationRank(candidate?.observation_type);
  const currentRank = clvObservationRank(current?.observation_type);
  if (candidateRank !== currentRank) return candidateRank > currentRank;
  return new Date(candidate?.observed_at || 0).getTime() > new Date(current?.observed_at || 0).getTime();
}

async function loadClvObservationCandidates(sourceIds) {
  const ids = Array.from(new Set((sourceIds || []).filter(Boolean).map(String)));
  if (!ids.length) return new Map();
  const chunks = [];
  for (let i = 0; i < ids.length; i += 75) chunks.push(ids.slice(i, i + 75));
  const candidatesById = new Map();
  for (const chunk of chunks) {
    const { data, error } = await sbClient
      .from('clv_observations')
      .select('ev_bet_id, event_id, stable_event_key, market_key, selection_key, line_key, ottelu, liiga, markkina, kohde, line, reference_odds, clv_pct, observation_type, observed_at, reference_book')
      .in('ev_bet_id', chunk)
      .in('observation_type', ['closing_reference', 'pre_start_reference'])
      .limit(1000);
    if (error) {
      console.warn('[Vedox] clv_observations fallback load failed:', error.message);
      return candidatesById;
    }
    (data || []).forEach(obs => {
      const id = obs?.ev_bet_id ? String(obs.ev_bet_id) : '';
      const referenceBook = String(obs?.reference_book || '').trim().toLowerCase();
      const clvOdds = parseFloat(obs?.reference_odds);
      const clvPct = parseFloat(obs?.clv_pct);
      if (
        !id
        || referenceBook !== 'pinnacle'
        || !Number.isFinite(clvOdds)
        || clvOdds <= 0
      ) return;
      const normalized = {
        ...obs,
        reference_odds: clvOdds,
        clv_pct: Number.isFinite(clvPct) ? clvPct : null,
      };
      const candidates = candidatesById.get(id) || [];
      candidates.push(normalized);
      candidatesById.set(id, candidates);
    });
  }
  return candidatesById;
}

async function loadUserBetSources(sourceIds) {
  const ids = Array.from(new Set((sourceIds || []).filter(Boolean).map(String)));
  if (!ids.length) return new Map();
  const chunks = [];
  for (let i = 0; i < ids.length; i += 75) chunks.push(ids.slice(i, i + 75));
  const sourcesById = new Map();
  const sourceLegacySelect = 'id, alkaa, ottelu, kohde, kirja, liiga, markkina';
  const sourceContractSelect = `${sourceLegacySelect}, event_id, stable_event_key, market_key, selection_key, line_key`;
  const sourceBaseSelect = `${sourceContractSelect}, aalto`;
  const sourceSteamSelect = `${sourceBaseSelect}, steam_quality_score, steam_edge_pct, signal_json`;

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex];
    let { data: sourceRows, error: sourceError } = await sbClient
      .from('ev_bets')
      .select(sourceSteamSelect)
      .in('id', chunk);
    if (sourceError && /steam_|signal_json|column|schema cache|does not exist/i.test(sourceError.message || '')) {
      const fallback = await sbClient
        .from('ev_bets')
        .select(sourceBaseSelect)
        .in('id', chunk);
      sourceRows = fallback.data;
      sourceError = fallback.error;
    }
    if (sourceError && /aalto|column|schema cache|does not exist/i.test(sourceError.message || '')) {
      const legacyFallback = await sbClient
        .from('ev_bets')
        .select(sourceLegacySelect)
        .in('id', chunk);
      sourceRows = legacyFallback.data;
      sourceError = legacyFallback.error;
    }
    if (sourceError) {
      console.warn(
        `[Vedox] user bet source metadata chunk ${chunkIndex + 1}/${chunks.length} load failed:`,
        sourceError.message,
      );
      continue;
    }
    (sourceRows || []).forEach(source => {
      if (source?.id) sourcesById.set(String(source.id), source);
    });
  }
  return sourcesById;
}

export async function loadUserBets(userId, tierCode) {
  if (!userId || !canAccess(tierCode, 'mybets')) return [];
  const baseSelect = 'id, created_at, date, match, target, book, odds, stake, ev, result, settled, returned_amount, market, source_bet_id';
  const clvSelect = `${baseSelect}, clv_odds, clv_pct, clv_checked_at, clv_source, auto_result_checked_at, auto_result_source`;
  const bettorSelect = `${clvSelect}, bettor_name`;
  let { data, error } = await sbClient
    .from('user_bets')
    .select(bettorSelect)
    .eq('user_id', userId)
    .gte('created_at', USER_BETS_MIGRATION_CUTOFF)
    .order('created_at', { ascending: false });
  if (error && /bettor_name|clv_|auto_result_|column|schema cache|does not exist/i.test(error.message || '')) {
    const clvFallback = await sbClient
      .from('user_bets')
      .select(clvSelect)
      .eq('user_id', userId)
      .gte('created_at', USER_BETS_MIGRATION_CUTOFF)
      .order('created_at', { ascending: false });
    data = clvFallback.data;
    error = clvFallback.error;
    if (error && /clv_|auto_result_|column|schema cache|does not exist/i.test(error.message || '')) {
      const fallback = await sbClient
        .from('user_bets')
        .select(baseSelect)
        .eq('user_id', userId)
        .gte('created_at', USER_BETS_MIGRATION_CUTOFF)
        .order('created_at', { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }
  }
  if (error) { console.warn('[Vedox] user_bets load failed:', error.message); return []; }
  const rows = data || [];
  const sourceIds = Array.from(new Set(rows.map(r => r.source_bet_id).filter(Boolean).map(String)));
  const [startsById, clvCandidatesBySourceId] = await Promise.all([
    loadUserBetSources(sourceIds),
    loadClvObservationCandidates(sourceIds),
  ]);
  return rows.map(row => {
    const sourceById = row.source_bet_id ? startsById.get(String(row.source_bet_id)) : null;
    const source = sourceById || null;
    const observationId = row.source_bet_id || null;
    const clvObservation = observationId
      ? (clvCandidatesBySourceId.get(String(observationId)) || [])
          .filter(candidate => clvObservationMatchesSource(candidate, sourceById))
          .reduce((best, candidate) => (
            isBetterClvObservation(candidate, best) ? candidate : best
          ), null)
      : null;
    const observationSource = clvObservation ? {
      ottelu: clvObservation.ottelu || '',
      kohde: clvObservation.kohde || clvObservation.line || '',
      liiga: clvObservation.liiga || '',
      league: clvObservation.liiga || '',
      markkina: clvObservation.markkina || '',
    } : null;
    const metadataSource = sourceById
      ? {
          ...sourceById,
          liiga: sourceById.liiga || observationSource?.liiga || '',
          league: sourceById.liiga || sourceById.league || observationSource?.liiga || '',
          markkina: sourceById.markkina || observationSource?.markkina || '',
          kohde: sourceById.kohde || observationSource?.kohde || '',
          ottelu: sourceById.ottelu || observationSource?.ottelu || '',
        }
      : observationSource || null;
    const taxonomy = deriveBetTaxonomy(row, metadataSource);
    const date = row.date || '';
    return dbBetToLocal({
      ...row,
      date,
      market: row.market || metadataSource?.markkina || '',
      aalto: metadataSource?.aalto || '',
      liiga: metadataSource?.liiga || row.liiga || '',
      league: taxonomy.league,
      sport: taxonomy.sport,
      taxonomy_status: taxonomy.taxonomyStatus,
      taxonomy_reason: taxonomy.taxonomyReason,
      source_clv_odds: clvObservation?.reference_odds,
      source_clv_pct: clvObservation?.clv_pct,
      source_clv_checked_at: clvObservation?.observed_at,
      source_starts_at: sourceById?.alkaa || row.date || null,
      source_clv_source: clvObservation
        ? (clvObservation.observation_type === 'closing_reference' ? 'clv_observations_closing' : 'clv_observations_prestart')
        : '',
      steam_quality_score: source?.steam_quality_score ?? row.steam_quality_score,
      steam_edge_pct: source?.steam_edge_pct ?? row.steam_edge_pct,
      signal_json: source?.signal_json ?? row.signal_json,
    });
  });
}

export async function addUserBet(userId, bet) {
  const row = {
    user_id:         userId,
    created_at:      new Date().toISOString(),
    date:            toDateTimeInputValue(bet.startsAt || bet.date) || formatBetDate(bet.startsAt || bet.date),
    match:           bet.match,
    target:          bet.outcome,
    book:            normalizeBookName(bet.book),
    odds:            bet.odds,
    stake:           bet.stake,
    ev:              bet.edge,
    result:          'pending',
    settled:         false,
    returned_amount: 0,
    market:          bet.market || '',
    potential:       bet.odds * bet.stake,
    source_bet_id:   bet.sourceBetId || null,
    bettor_name:     bet.bettorName || null,
  };

  if (bet.sourceBetId) {
    const { data: existing, error: existingError } = await sbClient
      .from('user_bets')
      .select('id')
      .eq('user_id', userId)
      .eq('source_bet_id', bet.sourceBetId)
      .gte('created_at', USER_BETS_MIGRATION_CUTOFF)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return { duplicate: true };
  }

  let { error } = await sbClient.from('user_bets').insert(row);
  if (error && /bettor_name|column|schema cache|does not exist/i.test(error.message || '')) {
    const retryRow = { ...row };
    delete retryRow.bettor_name;
    const retry = await sbClient.from('user_bets').insert(retryRow);
    error = retry.error;
  }
  if (error) {
    if (bet.sourceBetId && error.code === '23505') {
      let { error: updateError } = await sbClient
        .from('user_bets')
        .update(row)
        .eq('user_id', userId)
        .eq('source_bet_id', bet.sourceBetId);
      if (updateError && /bettor_name|column|schema cache|does not exist/i.test(updateError.message || '')) {
        const retryRow = { ...row };
        delete retryRow.bettor_name;
        const retry = await sbClient
          .from('user_bets')
          .update(retryRow)
          .eq('user_id', userId)
          .eq('source_bet_id', bet.sourceBetId);
        updateError = retry.error;
      }
      if (updateError) throw updateError;
      return { duplicate: false };
    }
    throw error;
  }
  return { duplicate: false };
}

export async function deleteUserBet(userId, dbId) {
  const { data, error } = await sbClient
    .from('user_bets')
    .delete()
    .eq('id', dbId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Poistettavaa vetoa ei löytynyt tai käyttöoikeus puuttuu.');
  return data;
}

export async function updateUserBetResult(userId, dbId, result, odds, stake) {
  const normalized = ['won', 'lost', 'push', 'pending', 'half_won', 'half_lost'].includes(result) ? result : 'pending';
  const settled = normalized !== 'pending';
  const returnedAmount = normalized === 'won' ? odds * stake
                       : normalized === 'push' ? stake
                       : normalized === 'half_won' ? stake + (((odds - 1) * stake) / 2)
                       : normalized === 'half_lost' ? stake / 2
                       : 0;
  const { data, error } = await sbClient
    .from('user_bets')
    .update({
      result: normalized,
      settled,
      returned_amount: returnedAmount,
    })
    .eq('id', dbId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Vedon tulosta ei voitu vahvistaa tietokannasta.');
  return data;
}

export async function updateUserBetDate(userId, dbId, dateValue) {
  const { data, error } = await sbClient
    .from('user_bets')
    .update({ date: toDateTimeInputValue(dateValue) || dateValue || '' })
    .eq('id', dbId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Vedon päivämäärää ei voitu vahvistaa tietokannasta.');
  return data;
}

export async function updateUserBetTerms(userId, dbId, {
  odds,
  stake,
  ev,
  returnedAmount,
  expectedOdds,
  expectedStake,
  expectedEv,
  expectedResult,
  expectedSettled,
  expectedClvOdds = null,
  ownClvPct = null,
  preserveNulls = false,
}) {
  const cleanOdds = Number(odds);
  const cleanStake = Number(stake);
  const nextEvIsNull = preserveNulls && (ev === null || ev === undefined);
  const cleanEv = nextEvIsNull ? null : Number(ev);
  if (!userId || !dbId || !Number.isFinite(cleanOdds) || cleanOdds <= 1) {
    throw new Error('Kertoimen pitää olla suurempi kuin 1.');
  }
  if (!Number.isFinite(cleanStake) || cleanStake <= 0) {
    throw new Error('Panoksen pitää olla suurempi kuin 0.');
  }
  if (!nextEvIsNull && !Number.isFinite(cleanEv)) {
    throw new Error('Edun pitää olla numero.');
  }
  const cleanExpectedOdds = Number(expectedOdds);
  const cleanExpectedStake = Number(expectedStake);
  const expectedEvIsNull = expectedEv === null || expectedEv === undefined;
  const cleanExpectedEv = expectedEvIsNull ? null : Number(expectedEv);
  if (!Number.isFinite(cleanExpectedOdds) || !Number.isFinite(cleanExpectedStake) || (!expectedEvIsNull && !Number.isFinite(cleanExpectedEv))) {
    throw new Error('Vedon aiempia arvoja ei voitu varmistaa.');
  }
  const expectedResultIsNull = expectedResult === null || expectedResult === undefined;
  if (!expectedResultIsNull && !['pending', 'won', 'lost', 'push', 'half_won', 'half_lost'].includes(expectedResult)) {
    throw new Error('Vedon aiempi tulostila ei ole kelvollinen.');
  }
  const expectedSettledIsNull = expectedSettled === null || expectedSettled === undefined;
  if (!expectedSettledIsNull && typeof expectedSettled !== 'boolean') {
    throw new Error('Vedon aiempaa ratkaisutilaa ei voitu varmistaa.');
  }

  const update = {
    odds: cleanOdds,
    stake: cleanStake,
    ev: nextEvIsNull ? null : cleanEv,
    potential: cleanOdds * cleanStake,
    returned_amount: preserveNulls && (returnedAmount === null || returnedAmount === undefined)
      ? null
      : (Number.isFinite(Number(returnedAmount)) ? Number(returnedAmount) : 0),
  };
  const cleanExpectedClvOdds = Number(expectedClvOdds);
  if (Number.isFinite(cleanExpectedClvOdds) && cleanExpectedClvOdds > 0 && Number.isFinite(Number(ownClvPct))) {
    update.clv_pct = Number(ownClvPct);
  }

  let query = sbClient
    .from('user_bets')
    .update(update)
    .eq('id', dbId)
    .eq('user_id', userId)
    .eq('odds', cleanExpectedOdds)
    .eq('stake', cleanExpectedStake);
  query = expectedEvIsNull ? query.is('ev', null) : query.eq('ev', cleanExpectedEv);
  query = expectedResultIsNull ? query.is('result', null) : query.eq('result', expectedResult);
  query = expectedSettledIsNull ? query.is('settled', null) : query.eq('settled', expectedSettled);
  if (Object.prototype.hasOwnProperty.call(update, 'clv_pct')) {
    query = query.eq('clv_odds', cleanExpectedClvOdds);
  }
  const { data, error } = await query
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error('Veto muuttui toisessa näkymässä. Päivitä sivu ennen uutta tallennusta.');
  return data;
}

// --- Book balances --------------------------------------------------------
export async function loadBookBalances(userId, tierCode) {
  if (!userId || !canAccess(tierCode, 'mybets')) return [];
  const { data, error } = await sbClient
    .from('user_book_balances')
    .select('book, balance, updated_at')
    .eq('user_id', userId)
    .order('book', { ascending: true });
  if (error) { console.warn('[Vedox] book balances load failed:', error.message); return []; }
  const grouped = new Map();
  (data || []).forEach(r => {
    const book = normalizeBookName(r.book);
    const current = grouped.get(book) || { book, balance: 0, updatedAt: r.updated_at };
    current.balance += parseFloat(r.balance) || 0;
    if (r.updated_at && (!current.updatedAt || r.updated_at > current.updatedAt)) current.updatedAt = r.updated_at;
    grouped.set(book, current);
  });
  return Array.from(grouped.values()).map(r => ({
    book: r.book,
    balance: parseFloat(r.balance) || 0,
    updatedAt: r.updatedAt,
  }));
}

export async function saveBookBalance(userId, book, balance) {
  if (!userId || !book) return null;
  const cleanBook = normalizeBookName(book);
  const safeBalance = Number.isFinite(Number(balance)) ? Number(balance) : 0;
  const { data, error } = await sbClient
    .from('user_book_balances')
    .upsert({
      user_id: userId,
      book: cleanBook,
      balance: safeBalance,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,book' })
    .select('book, balance, updated_at')
    .maybeSingle();
  if (error) throw error;
  return data ? { book: normalizeBookName(data.book), balance: parseFloat(data.balance) || 0, updatedAt: data.updated_at } : null;
}

export async function updateBookBalanceIfUnchanged(userId, book, {
  expectedBalance,
  expectedUpdatedAt,
  balance,
}) {
  if (!userId || !book || !expectedUpdatedAt) {
    throw new Error('Bookmaker-kassan aiempaa tilaa ei voitu varmistaa.');
  }
  const cleanBook = normalizeBookName(book);
  const cleanExpectedBalance = Number(expectedBalance);
  const cleanBalance = Number(balance);
  if (!Number.isFinite(cleanExpectedBalance) || !Number.isFinite(cleanBalance)) {
    throw new Error('Bookmaker-kassan saldo ei ole kelvollinen.');
  }
  const { data, error } = await sbClient
    .from('user_book_balances')
    .update({
      balance: cleanBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('book', cleanBook)
    .eq('balance', cleanExpectedBalance)
    .eq('updated_at', expectedUpdatedAt)
    .select('book, balance, updated_at')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Bookmaker-kassa muuttui toisessa näkymässä. Päivitä sivu ennen uutta tallennusta.');
  return {
    book: normalizeBookName(data.book),
    balance: parseFloat(data.balance) || 0,
    updatedAt: data.updated_at,
  };
}

// â”€â”€â”€ Bankroll snapshots â€” vain analytics-oikeudella â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function loadBankrollSnapshots(userId, tierCode) {
  if (!userId || !canAccess(tierCode, 'analytics')) return [];
  const { data, error } = await sbClient
    .from('bankroll_snapshots')
    .select('bankroll, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(60);
  if (error) { console.warn('[Vedox] snapshots load failed:', error.message); return []; }
  return (data || []).map(r => ({ amount: parseFloat(r.bankroll), date: r.created_at?.slice(0, 10) }));
}

export async function addBankrollSnapshot(userId, bankroll) {
  await sbClient.from('bankroll_snapshots').insert({ user_id: userId, bankroll, muutos: 0 });
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function normalizeBookName(book) {
  const raw = String(book || '').trim();
  if (!raw) return '';
  const compact = raw.toLowerCase().replace(/\s+/g, ' ');
  if (compact.startsWith('unibet')) return 'Unibet';
  if (compact.startsWith('leovegas')) return 'LeoVegas';
  if (compact.startsWith('betfair exchange')) return 'Betfair Exchange';
  if (compact.startsWith('betfair sportsbook')) return 'Betfair Sportsbook';
  if (compact === 'betfair') return 'Betfair Exchange';
  if (compact.startsWith('nordic bet') || compact.startsWith('nordicbet')) return 'Nordic Bet';
  if (compact.startsWith('william hill')) return 'William Hill';
  if (compact.startsWith('1xbet')) return '1xBet';
  return raw.replace(/\s+\((se|fi|nl|fr|it|de|uk)\)$/i, '');
}

export const UNKNOWN_TAXONOMY_LABEL = 'Määrittämätön';
const UNKNOWN_TAXONOMY_VALUES = new Set(['muu', 'other', 'unknown', 'tarkistettava', 'määrittämätön', 'maarittamaton', '-', 'n/a']);

export function cleanTaxonomyValue(value) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  return UNKNOWN_TAXONOMY_VALUES.has(clean.toLowerCase()) ? '' : clean;
}

export function sportFromLeague(liiga) {
  const s = String(liiga || '').toLowerCase();
  if (!s) return '';

  const hasAny = (tokens) => tokens.some(token => s.includes(token));
  const soccerTokens = [
    'soccer', 'premier league', 'serie a', 'la_liga', 'ligue', 'mls', 'champions',
    'veikkaus', 'fifa', 'allsvenskan', 'copa sudamericana', 'copa libertadores',
    'vila nova', 'botafogo', 'coquimbo', "o'higgins", 'deportes', 'limache',
    'orebro', 'örebro', 'gif sundsvall', 'dalian yingbo', 'qingdao west coast',
    'fortaleza', 'america mineiro', 'atlético mineiro', 'atletico mineiro',
    'north melbourne', 'melbourne city', 'santos', 'vitoria', 'mirassol'
  ];
  const cricketTokens = [
    'cricket', 't20 blast', 'ipl', 'somerset', 'glamorgan', 'sussex', 'hampshire',
    'durham', 'lancashire', 'yorkshire', 'surrey', 'essex', 'kent', 'warwickshire',
    'nottinghamshire', 'leicestershire', 'derbyshire', 'worcestershire',
    'middlesex', 'northamptonshire', 'punjab kings', 'royal challengers bangalore',
    'bengaluru', 'delhi capitals', 'mumbai indians', 'sunrisers'
  ];
  const baseballTokens = [
    'baseball', 'mlb', 'kbo', 'npb', 'phillies', 'padres', 'diamondbacks',
    'dodgers', 'rays', 'tigers', 'dragons', 'hawks', 'yankees', 'guardians',
    'red sox', 'blue jays', 'orioles', 'white sox', 'royals', 'twins', 'astros',
    'athletics', 'rangers', 'angels', 'mariners', 'mets', 'braves', 'marlins',
    'nationals', 'cubs', 'reds', 'brewers', 'pirates', 'cardinals', 'rockies',
    'giants', 'nc dinos', 'doosan bears', 'lotte giants', 'kia tigers',
    'yakult swallows', 'yomiuri giants'
  ];
  const handballTokens = [
    'handball', 'käsipallo', 'hsv hamburg', 'hsg wetzlar', 'rhein-neckar',
    'hannover', 'gwd minden', 'thw kiel', 'flensburg', 'gummersbach',
    'magdeburg', 'lemgo', 'fuchse berlin', 'füchse berlin'
  ];

  if (hasAny(cricketTokens)) return 'Cricket';
  if (s.includes('boxing') || s.includes('mma') || s.includes('ufc') || s.includes('nyrkkeily')) return 'Kamppailulajit';
  if (s.includes('nhl') || s.includes('icehockey') || s.includes('ice hockey') || s.includes('khl') || s.includes('jaakiekko')) return 'Jääkiekko';
  if (s.includes('nba') || s.includes('wnba') || s.includes('basketball') || s.includes('koripallo') || s.includes('lynx') || s.includes('valkyries') || s.includes('fever') || s.includes('dream')) return 'Koripallo';
  if (s.includes('tennis') || s.includes('atp') || s.includes('wta')) return 'Tennis';
  if (hasAny(baseballTokens)) return 'Baseball';
  if (hasAny(handballTokens)) return 'Käsipallo';
  if (s.includes('americanfootball') || s.includes('american football') || s.includes('cfl') || s.includes('nfl') || s.includes('alouettes') || s.includes('tiger-cats') || s.includes('redblacks') || s.includes('elks')) return 'Amerikkalainen jalkapallo';
  if (s.includes('rugbyleague') || s.includes('rugby league') || s.includes('nrl') || s.includes('melbourne storm') || s.includes('newcastle knights') || s.includes('cowboys') || s.includes('dolphins')) return 'Rugby League';
  if (s.includes('aussierules') || s.includes('aussie rules') || s.includes('afl') || s.includes('west coast eagles') || s.includes('port adelaide')) return 'AFL';
  if (hasAny(soccerTokens) || s.includes('jalkapallo')) return 'Jalkapallo';
  return '';
}
export function formatLeague(liiga) {
  const map = {
    soccer_epl: 'Premier League', soccer_england_premier_league: 'Premier League',
    soccer_spain_la_liga: 'La Liga', soccer_germany_bundesliga: 'Bundesliga',
    soccer_italy_serie_a: 'Serie A', soccer_france_ligue_one: 'Ligue 1',
    soccer_uefa_champs_league: 'Champions League', soccer_finland_veikkausliiga: 'Veikkausliiga',
    soccer_fifa_world_cup: 'MM-kisat 2026',
    icehockey_nhl: 'NHL', icehockey_liiga: 'Liiga', icehockey_khl: 'KHL',
    tennis_atp_french_open: 'ATP Roland Garros', tennis_wta_french_open: 'WTA Roland Garros',
    cricket_t20_blast: 'T20 Blast', baseball_mlb: 'MLB', baseball_kbo: 'KBO', baseball_npb: 'NPB', boxing_boxing: 'Nyrkkeily',
    rugbyleague_nrl: 'NRL', aussierules_afl: 'AFL',
    soccer_sweden_allsvenskan: 'Allsvenskan',
    soccer_conmebol_copa_sudamericana: 'Copa Sudamericana',
    soccer_conmebol_copa_libertadores: 'Copa Libertadores',
    soccer_argentina_primera_division: 'Primera Division',
    soccer_brazil_campeonato: 'Brasileirao',
    soccer_chile_campeonato: 'Primera Division Chile',
    soccer_denmark_superliga: 'Superliga',
    soccer_norway_eliteserien: 'Eliteserien',
    soccer_finland_ykkosliiga: 'Ykkösliiga',
  };
  const key = String(liiga || '').toLowerCase().trim();
  for (const [k, v] of Object.entries(map)) { if (key.includes(k)) return v; }
  if (!key) return '';
  const cleaned = key
    .replace(/^soccer_/, '')
    .replace(/^(usa|sweden|norway|denmark|finland|brazil|argentina|chile|conmebol)_/, '')
    .split('_')
    .filter(Boolean)
    .map(w => w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return cleaned || liiga || '';
}

export function deriveBetTaxonomy(bet = {}, source = null, options = {}) {
  const fallbackLabel = options.fallbackLabel || UNKNOWN_TAXONOMY_LABEL;
  const sourceLeagueRaw = cleanTaxonomyValue(source?.liiga || source?.league);
  const betLeagueRaw = cleanTaxonomyValue(bet.liiga || bet.league);
  const leagueRaw = sourceLeagueRaw || betLeagueRaw;
  const formattedLeague = cleanTaxonomyValue(leagueRaw && leagueRaw.includes('_') ? formatLeague(leagueRaw) : leagueRaw);
  const sourceSport = cleanTaxonomyValue(source?.sport);
  const betSport = cleanTaxonomyValue(bet.sport);
  const derivedSport = cleanTaxonomyValue(sportFromLeague([
    leagueRaw,
    formattedLeague,
    bet.match || bet.ottelu,
    bet.outcome || bet.target || bet.kohde,
    bet.market || bet.markkina,
  ].filter(Boolean).join(' ')));
  const sport = sourceSport || betSport || derivedSport;
  const reason = formattedLeague && sport
    ? 'ok'
    : !source && !sourceLeagueRaw && !betLeagueRaw
      ? 'missing_source_or_league'
      : formattedLeague && !sport
        ? 'unknown_sport'
        : 'missing_league';
  return {
    sport: sport || fallbackLabel,
    league: formattedLeague || fallbackLabel,
    market: cleanTaxonomyValue(bet.market || bet.markkina)?.toUpperCase() || 'MÄÄRITTÄMÄTÖN',
    taxonomyStatus: sport && formattedLeague ? 'ok' : 'missing',
    taxonomyReason: reason,
    sourceLeague: sourceLeagueRaw || '',
  };
}
export function formatTime(isoStr) {
  if (!isoStr) return { day: '-', time: '-' };
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return { day: '-', time: '-' };
  const now = new Date();
  const todayKey = fiDateKey(now);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = fiDateKey(tomorrow);
  const dayKey = fiDateKey(d);
  const parts = fiDateParts(d);
  const time = `${parts.hour}:${parts.minute}`;
  if (dayKey === todayKey) return { day: 'Tänään', time };
  if (dayKey === tomorrowKey) return { day: 'Huomenna', time };
  return { day: d.toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric', timeZone: FINNISH_TIME_ZONE }), time };
}


