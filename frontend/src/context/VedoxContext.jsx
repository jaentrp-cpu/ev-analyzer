// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Vedox Â· Global state context
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import {
  sbClient, loadProfile, loadUserSettings, saveUserSettings,
  fetchEvBets, fetchArbitrages, loadUserBets, addUserBet, deleteUserBet,
  updateUserBetResult, updateUserBetDate, updateUserBetTerms, loadBankrollSnapshots, addBankrollSnapshot,
  loadBookBalances, saveBookBalance, updateBookBalanceIfUnchanged,
  normalizeTier, tierLabel, canAccess,
  deriveBetTaxonomy, formatTime, normalizeBookName,
} from '../supabase.js';
import { DEFAULT_KELLY_FRACTION, normalizeKellyFraction } from '../staking.js';

const Ctx = createContext(null);
export const useVedox = () => useContext(Ctx);

const REFRESH_MS = 5 * 60 * 1000;
const DEFAULT_BANKROLL = 500;
const FINNISH_TIME_ZONE = 'Europe/Helsinki';
const DEFAULT_BOOK_BALANCE_BOOKS = [
  '1xBet',
  'Unibet',
  'Coolbet',
  'Betsson',
  'William Hill',
  'LeoVegas',
  'Everygame',
  'Betfair Exchange',
];

function dataChanged(prev, next) {
  try {
    return JSON.stringify(prev) !== JSON.stringify(next);
  } catch {
    return true;
  }
}

function returnedAmountForResult(result, odds, stake) {
  const safeOdds = Number(odds) || 0;
  const safeStake = Number(stake) || 0;
  if (result === 'won') return safeOdds * safeStake;
  if (result === 'push') return safeStake;
  if (result === 'half_won') return safeStake + (((safeOdds - 1) * safeStake) / 2);
  if (result === 'half_lost') return safeStake / 2;
  return 0;
}

function formatBetDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('fi-FI', { day: '2-digit', month: 'numeric', timeZone: FINNISH_TIME_ZONE });
}

function fiTimeParts(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('fi-FI', {
    timeZone: FINNISH_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
}

function formatBetDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const date = d.toLocaleDateString('fi-FI', { day: '2-digit', month: 'numeric', timeZone: FINNISH_TIME_ZONE });
  const parts = fiTimeParts(d);
  return `${date} ${parts.hour}.${parts.minute}`;
}

export function VedoxProvider({ children }) {
  // Auth
  const [session,   setSession]   = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [showAuth,  setShowAuth]  = useState(false);

  // Profile
  const [profile,  setProfile]  = useState(null);
  const [tierCode, setTierCode] = useState('none');

  // Settings
  const [bankroll,  setBankrollState] = useState(0);
  const [flatStake, setFlatStakeState] = useState(10);
  const [stakeMode, setStakeModeState] = useState('percent');
  const [stakePct,  setStakePctState] = useState(1);
  const [kellyFraction, setKellyFractionState] = useState(DEFAULT_KELLY_FRACTION);
  const [lang, setLangState] = useState(() => localStorage.getItem('vedox_lang') || 'fi');
  const [settingsSaveStatus, setSettingsSaveStatus] = useState('idle');
  const [settingsSaveError, setSettingsSaveError] = useState('');

  // Data
  const [evBets,     setEvBets]     = useState([]);
  const [arbitrages, setArbitrages] = useState([]);
  const [userBets,   setUserBets]   = useState([]);
  const [bookBalances, setBookBalances] = useState([]);
  const [hiddenBookBalanceBooks, setHiddenBookBalanceBooks] = useState([]);
  const [snapshots,  setSnapshots]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const settingsTimersRef = useRef(new Map());
  const settingsSaveChainsRef = useRef(new Map());
  const settingsRequestRef = useRef({});
  const settingsPendingRef = useRef(new Set());
  const settingsErrorRef = useRef('');
  const settingsValuesRef = useRef({
    bankroll: 0,
    flat_stake: 10,
    stake_mode: 'percent',
    stake_pct: 1,
    kelly_fraction: DEFAULT_KELLY_FRACTION,
    lang,
  });
  const committedSettingsRef = useRef({ ...settingsValuesRef.current });
  const currentUserIdRef = useRef(null);
  const settingsSessionGenerationRef = useRef(0);
  const initRunRef = useRef(0);

  function clearSettingsTimers() {
    settingsTimersRef.current.forEach(timer => clearTimeout(timer));
    settingsTimersRef.current.clear();
  }

  function applySettingValue(key, value) {
    settingsValuesRef.current[key] = value;
    if (key === 'bankroll') setBankrollState(value);
    if (key === 'flat_stake') setFlatStakeState(value);
    if (key === 'stake_mode') setStakeModeState(value);
    if (key === 'stake_pct') setStakePctState(value);
    if (key === 'kelly_fraction') setKellyFractionState(value);
    if (key === 'lang') {
      setLangState(value);
      document.documentElement.lang = value;
    }
  }

  function writeSettingToLocalStorage(userId, key, value) {
    if (key === 'lang') {
      localStorage.setItem('vedox_lang', String(value));
      return;
    }
    const storageKeys = {
      bankroll: 'vedox_bankroll',
      flat_stake: 'vedox_flatstake',
      stake_mode: 'vedox_stake_mode',
      stake_pct: 'vedox_stake_pct',
      kelly_fraction: 'vedox_kelly_fraction',
    };
    if (storageKeys[key] && userId) {
      localStorage.setItem(`${storageKeys[key]}_${userId}`, String(value));
    }
  }

  function rememberCommittedSetting(key, value) {
    settingsValuesRef.current[key] = value;
    committedSettingsRef.current[key] = value;
  }

  function queueSettingSave(key, value, { delay = 0 } = {}) {
    const userId = session?.user?.id;
    if (!userId) return;

    const sessionGeneration = settingsSessionGenerationRef.current;
    const requestId = (settingsRequestRef.current[key] || 0) + 1;
    settingsRequestRef.current[key] = requestId;
    settingsPendingRef.current.add(key);
    settingsErrorRef.current = '';
    setSettingsSaveError('');
    setSettingsSaveStatus('saving');

    const previousTimer = settingsTimersRef.current.get(key);
    if (previousTimer) clearTimeout(previousTimer);

    const persist = () => {
      settingsTimersRef.current.delete(key);
      const chainKey = `${userId}:${key}`;
      const previousSave = settingsSaveChainsRef.current.get(chainKey) || Promise.resolve();
      const currentSave = previousSave
        .catch(() => {})
        .then(async () => {
          try {
            await saveUserSettings(userId, { [key]: value });
            if (
              currentUserIdRef.current !== userId
              || settingsSessionGenerationRef.current !== sessionGeneration
            ) return;

            // Writes for one user + setting are serialized, so this is the
            // database's newest confirmed value even if another UI change is
            // already waiting behind it.
            committedSettingsRef.current[key] = value;
            if (settingsRequestRef.current[key] !== requestId) return;

            settingsPendingRef.current.delete(key);
            setSettingsSaveStatus(
              settingsErrorRef.current
                ? 'error'
                : settingsPendingRef.current.size ? 'saving' : 'saved'
            );
          } catch (error) {
            if (
              settingsRequestRef.current[key] !== requestId
              || currentUserIdRef.current !== userId
              || settingsSessionGenerationRef.current !== sessionGeneration
            ) return;
            const committedValue = committedSettingsRef.current[key];
            applySettingValue(key, committedValue);
            writeSettingToLocalStorage(userId, key, committedValue);
            settingsPendingRef.current.delete(key);
            const errorText = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`;
            const stakingSchemaMissing = (
              key === 'stake_mode' || key === 'kelly_fraction'
            ) && (
              error?.code === '42703'
              || error?.code === 'PGRST204'
              || /(?:stake_mode|kelly_fraction).*(?:does not exist|schema cache)/i.test(errorText)
            );
            const message = stakingSchemaMissing
              ? (lang === 'en'
                ? 'Stake model cloud saving needs a database update. The previous value was restored.'
                : 'Panosmallin pilvitallennus vaatii tietokantapäivityksen. Edellinen arvo palautettiin.')
              : (lang === 'en'
                ? 'Settings could not be saved. The previous saved value was restored.'
                : 'Asetusten tallennus epäonnistui. Edellinen tallennettu arvo palautettiin.');
            settingsErrorRef.current = message;
            setSettingsSaveError(message);
            setSettingsSaveStatus('error');
            console.warn(`[Vedox] ${key} save failed:`, error.message);
          }
        });

      settingsSaveChainsRef.current.set(chainKey, currentSave);
      void currentSave.finally(() => {
        if (settingsSaveChainsRef.current.get(chainKey) === currentSave) {
          settingsSaveChainsRef.current.delete(chainKey);
        }
      });
    };

    if (delay > 0) {
      const timer = setTimeout(persist, delay);
      settingsTimersRef.current.set(key, timer);
    } else {
      persist();
    }
  }

  function clearProtectedData() {
    clearSettingsTimers();
    settingsSessionGenerationRef.current += 1;
    settingsRequestRef.current = {};
    settingsPendingRef.current.clear();
    settingsErrorRef.current = '';
    setSettingsSaveStatus('idle');
    setSettingsSaveError('');
    setProfile(null);
    setTierCode('none');
    applySettingValue('bankroll', 0);
    applySettingValue('flat_stake', 10);
    applySettingValue('stake_mode', 'percent');
    applySettingValue('stake_pct', 1);
    applySettingValue('kelly_fraction', DEFAULT_KELLY_FRACTION);
    committedSettingsRef.current = { ...settingsValuesRef.current };
    setUserBets([]);
    setBookBalances([]);
    setHiddenBookBalanceBooks([]);
    setSnapshots([]);
    setEvBets([]);
    setArbitrages([]);
  }

  // â”€â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    sbClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthReady(true);
    });
    const { data: { subscription } } = sbClient.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => () => {
    clearSettingsTimers();
    settingsSessionGenerationRef.current += 1;
  }, []);

  // â”€â”€â”€ Load/reset on session change â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!authReady) return;
    const userId = session?.user?.id || null;
    if (!userId) {
      currentUserIdRef.current = null;
      initRunRef.current += 1;
      clearProtectedData();
      setPermissionsReady(true);
      return;
    }

    if (currentUserIdRef.current === userId && permissionsReady) return;

    currentUserIdRef.current = userId;
    const runId = initRunRef.current + 1;
    initRunRef.current = runId;
    setPermissionsReady(false);
    clearProtectedData();
    initUserData(session.user, runId);
  }, [session?.user?.id, authReady, permissionsReady]);

  // â”€â”€â”€ Fetch public/tier data when tier is known â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!authReady) return;
    refreshEvData(tierCode);
  }, [tierCode, authReady]);

  // â”€â”€â”€ Auto-refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const t = setInterval(() => refreshEvData(tierCode, { silent: true }), REFRESH_MS);
    return () => clearInterval(t);
  }, [tierCode]);

  async function initUserData(user, runId) {
    try {
    const tier = normalizeTier('none'); // temp
    const [prof, settings] = await Promise.all([
      loadProfile(user),
      loadUserSettings(user.id),
    ]);
    let effectiveSettings = settings;
    const pendingRaw = localStorage.getItem(`vedox_pending_settings_${user.id}`);
    if (pendingRaw) {
      try {
        const pendingSettings = JSON.parse(pendingRaw);
        await saveUserSettings(user.id, pendingSettings);
        effectiveSettings = { ...(settings || {}), ...pendingSettings };
        localStorage.removeItem(`vedox_pending_settings_${user.id}`);
      } catch (err) {
        const message = lang === 'en'
          ? 'Signup settings could not be saved. Please try again from profile settings.'
          : 'Rekisteröinnin asetuksia ei voitu tallentaa. Yritä uudelleen profiiliasetuksista.';
        settingsErrorRef.current = message;
        setSettingsSaveError(message);
        setSettingsSaveStatus('error');
        console.warn('[Vedox] pending signup settings failed:', err.message);
      }
    }
    if (runId !== initRunRef.current) return;
    const resolvedTier = prof.tier_code;
    setProfile(prof);
    setTierCode(resolvedTier);
    const hiddenRaw = localStorage.getItem(`vedox_hidden_book_balances_${user.id}`);
    try {
      const hidden = JSON.parse(hiddenRaw || '[]');
      setHiddenBookBalanceBooks(Array.isArray(hidden) ? hidden.filter(Boolean) : []);
    } catch {
      setHiddenBookBalanceBooks([]);
    }

    const localMode = localStorage.getItem(`vedox_stake_mode_${user.id}`);
    const savedMode = String(effectiveSettings?.stake_mode || '');
    const resolvedMode = ['percent', 'fixed', 'kelly'].includes(savedMode)
      ? savedMode
      : ['percent', 'fixed', 'kelly'].includes(localMode) ? localMode
      : (effectiveSettings?.stake_pct != null ? 'percent' : 'fixed');
    applySettingValue('stake_mode', resolvedMode);
    rememberCommittedSetting('stake_mode', resolvedMode);
    localStorage.setItem(`vedox_stake_mode_${user.id}`, resolvedMode);
    const resolvedKellyFraction = normalizeKellyFraction(
      effectiveSettings?.kelly_fraction
        ?? localStorage.getItem(`vedox_kelly_fraction_${user.id}`)
    );
    applySettingValue('kelly_fraction', resolvedKellyFraction);
    rememberCommittedSetting('kelly_fraction', resolvedKellyFraction);
    const localPct = localStorage.getItem(`vedox_stake_pct_${user.id}`);
    const resolvedStakePct = effectiveSettings?.stake_pct != null
      ? parseFloat(effectiveSettings.stake_pct) || 1
      : parseFloat(localPct) || 1;
    applySettingValue('stake_pct', resolvedStakePct);
    rememberCommittedSetting('stake_pct', resolvedStakePct);

    // Fixed flat stake is used when stake mode is fixed.
    const localFlatStake = localStorage.getItem(`vedox_flatstake_${user.id}`);
    const resolvedFlatStake = effectiveSettings?.flat_stake != null
      ? parseFloat(effectiveSettings.flat_stake)
      : parseFloat(localFlatStake) || 10;
    applySettingValue('flat_stake', resolvedFlatStake);
    rememberCommittedSetting('flat_stake', resolvedFlatStake);
    const localBankrollRaw = localStorage.getItem(`vedox_bankroll_${user.id}`);
    const localBankroll = parseFloat(localBankrollRaw);
    const savedBankroll = parseFloat(effectiveSettings?.bankroll);
    const resolvedBankroll = savedBankroll > 0
        ? savedBankroll
      : localBankroll > 0
        ? localBankroll
        : DEFAULT_BANKROLL;
    applySettingValue('bankroll', resolvedBankroll);
    rememberCommittedSetting('bankroll', resolvedBankroll);
    localStorage.setItem(`vedox_bankroll_${user.id}`, String(resolvedBankroll));
    if (localBankrollRaw != null && resolvedBankroll !== savedBankroll) {
      saveUserSettings(user.id, { bankroll: resolvedBankroll }).catch(err => {
        const message = lang === 'en'
          ? 'The bankroll is available on this device, but cloud sync failed.'
          : 'Kassa on käytössä tällä laitteella, mutta pilvitallennus epäonnistui.';
        settingsErrorRef.current = message;
        setSettingsSaveError(message);
        setSettingsSaveStatus('error');
        console.warn('[Vedox] bankroll sync failed:', err.message);
      });
    }
    if (effectiveSettings?.lang === 'en' || effectiveSettings?.lang === 'fi') {
      applySettingValue('lang', effectiveSettings.lang);
      rememberCommittedSetting('lang', effectiveSettings.lang);
      localStorage.setItem('vedox_lang', effectiveSettings.lang);
    } else {
      rememberCommittedSetting('lang', lang);
    }

    // Vetohistoria ja saldot avaavat sivun. Harvemmin käytetty snapshots-data
    // ladataan tämän jälkeen taustalla, jotta mobiili ei odota sitä.
    const [bets, balances] = await Promise.all([
      loadUserBets(user.id, resolvedTier),
      loadBookBalances(user.id, resolvedTier),
    ]);
    if (runId !== initRunRef.current) return;
    setUserBets(bets);
    setBookBalances(balances);
    loadBankrollSnapshots(user.id, resolvedTier).then(snaps => {
      if (runId === initRunRef.current) setSnapshots(snaps);
    }).catch(err => console.warn('[Vedox] bankroll snapshots background load failed:', err.message));
    } finally {
      if (runId === initRunRef.current) setPermissionsReady(true);
    }
  }

  async function refreshEvData(tier, opts = {}) {
    const showLoading = !opts.silent;
    if (showLoading) setLoading(true);
    try {
      const [bets, arbs] = await Promise.all([
        fetchEvBets(tier),
        fetchArbitrages(tier),
      ]);
      setEvBets(prev => dataChanged(prev, bets) ? bets : prev);
      setArbitrages(prev => dataChanged(prev, arbs) ? arbs : prev);
      if (!opts.silent) setLastUpdated(new Date());
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  // â”€â”€â”€ Bankroll setter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function setBankroll(val) {
    const safe = Number.isFinite(Number(val)) ? Number(val) : 0;
    applySettingValue('bankroll', safe);
    if (!session?.user) return;
    writeSettingToLocalStorage(session.user.id, 'bankroll', safe);
    queueSettingSave('bankroll', safe, { delay: 600 });
  }

  // â”€â”€â”€ Flat stake setter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function setFlatStake(val) {
    const safe = Number.isFinite(Number(val)) ? Number(val) : 1;
    applySettingValue('flat_stake', safe);
    if (!session?.user) return;
    writeSettingToLocalStorage(session.user.id, 'flat_stake', safe);
    queueSettingSave('flat_stake', safe, { delay: 600 });
  }

  function setStakeMode(mode) {
    const safe = ['percent', 'fixed', 'kelly'].includes(mode) ? mode : 'percent';
    applySettingValue('stake_mode', safe);
    if (session?.user) {
      writeSettingToLocalStorage(session.user.id, 'stake_mode', safe);
      queueSettingSave('stake_mode', safe);
    }
  }

  function setStakePct(val) {
    const safe = Number.isFinite(Number(val)) ? Number(val) : 1;
    applySettingValue('stake_pct', safe);
    if (!session?.user) return;
    writeSettingToLocalStorage(session.user.id, 'stake_pct', safe);
    queueSettingSave('stake_pct', safe, { delay: 600 });
  }

  function setKellyFraction(val) {
    const safe = normalizeKellyFraction(val);
    applySettingValue('kelly_fraction', safe);
    if (session?.user) {
      writeSettingToLocalStorage(session.user.id, 'kelly_fraction', safe);
      queueSettingSave('kelly_fraction', safe);
    }
  }

  function setLang(nextLang) {
    const safe = nextLang === 'en' ? 'en' : 'fi';
    applySettingValue('lang', safe);
    writeSettingToLocalStorage(session?.user?.id, 'lang', safe);
    if (session?.user) queueSettingSave('lang', safe);
  }

  async function setBookBalance(book, value) {
    const cleanBook = normalizeBookName(book);
    const safe = Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
    setHiddenBookBalanceBooks(prev => {
      const next = prev.filter(b => normalizeBookName(b) !== cleanBook);
      if (session?.user) localStorage.setItem(`vedox_hidden_book_balances_${session.user.id}`, JSON.stringify(next));
      return next;
    });
    setBookBalances(prev => {
      const next = prev.filter(b => normalizeBookName(b.book) !== cleanBook);
      return [...next, { book: cleanBook, balance: safe }].sort((a, b) => a.book.localeCompare(b.book));
    });
    if (!session?.user || !cleanBook) return;
    try {
      const saved = await saveBookBalance(session.user.id, cleanBook, safe);
      if (saved) {
        setBookBalances(prev => {
          const next = prev.filter(b => normalizeBookName(b.book) !== saved.book);
          return [...next, saved].sort((a, b) => a.book.localeCompare(b.book));
        });
      }
    } catch (err) {
      console.warn('[Vedox] book balance save failed:', err.message);
    }
  }

  async function addBookBalanceBook(book) {
    const clean = normalizeBookName(book);
    if (!clean) return;
    await setBookBalance(clean, bookBalanceMap.get(clean) || 0);
  }

  async function removeBookBalanceBook(book) {
    const clean = normalizeBookName(book);
    if (!clean) return;
    setHiddenBookBalanceBooks(prev => {
      const next = Array.from(new Set([...prev, clean]));
      if (session?.user) localStorage.setItem(`vedox_hidden_book_balances_${session.user.id}`, JSON.stringify(next));
      return next;
    });
    setBookBalances(prev => prev.filter(b => normalizeBookName(b.book) !== clean));
    if (session?.user) {
      try {
        await saveBookBalance(session.user.id, clean, 0);
      } catch (err) {
        console.warn('[Vedox] book balance remove failed:', err.message);
      }
    }
  }

  async function adjustBookBalance(book, delta) {
    const cleanBook = normalizeBookName(book);
    if (!cleanBook || !Number.isFinite(Number(delta)) || Number(delta) === 0) return;
    const current = bookBalances.find(b => normalizeBookName(b.book) === cleanBook)?.balance || 0;
    await setBookBalance(cleanBook, Math.max(0, Math.round((current + Number(delta)) * 100) / 100));
  }

  // â”€â”€â”€ Add bet â€” duplikaattisuoja source_bet_id:n perusteella â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function addBetFromEv(evBet) {
    if (!session?.user) { setShowAuth(true); return false; }
    const evId = String(evBet.id);
    // Client-puolen duplikaattitarkistus
    const exists = userBets.some(b => b.sourceBetId === evId);
    if (exists) return false;
    const optimisticId = `optimistic-${evId}-${Date.now()}`;
    const providedStake = Number(evBet.stake);
    const selectedStake = Number.isFinite(providedStake)
      ? Math.max(0, providedStake)
      : effectiveFlatStake;
    if (selectedStake <= 0) {
      throw new Error('Panoksen pitää olla suurempi kuin 0.');
    }
    const selectedOdds = Number(evBet.odds) > 1 ? Number(evBet.odds) : 0;
    const selectedEdge = Number.isFinite(Number(evBet.edge)) ? Number(evBet.edge) : 0;
    const optimisticBet = {
      _dbId: optimisticId,
      createdAt: new Date().toISOString(),
      date: formatBetDateTime(evBet.startsAt),
      match: evBet.match,
      outcome: evBet.outcome,
      book: normalizeBookName(evBet.book),
      odds: selectedOdds,
      stake: selectedStake,
      ev: selectedEdge,
      status: 'pending',
      settled: false,
      market: evBet.market,
      sourceBetId: evId,
      bettorName: evBet.bettorName || 'AJ',
      pnl: null,
    };
    setUserBets(prev => [optimisticBet, ...prev]);
    try {
      const result = await addUserBet(session.user.id, {
        match:       evBet.match,
        outcome:     evBet.outcome,
        book:        normalizeBookName(evBet.book),
        odds:        selectedOdds,
        stake:       selectedStake,
        edge:        selectedEdge,
        market:      evBet.market,
        sourceBetId: evId,
        startsAt:     evBet.startsAt,
        bettorName: evBet.bettorName || 'AJ',
      });
      if (result?.duplicate) {
        setUserBets(prev => prev.filter(b => b._dbId !== optimisticId));
        throw new Error('Veto on jo omissa vedoissa.');
      }
      await adjustBookBalance(evBet.book, -selectedStake);
      const fresh = await loadUserBets(session.user.id, tierCode);
      setUserBets(fresh);
      if (canAccess(tierCode, 'analytics')) {
        await addBankrollSnapshot(session.user.id, bankroll);
      }
      return true;
    } catch (err) {
      setUserBets(prev => prev.filter(b => b._dbId !== optimisticId));
      console.warn('[Vedox] addBetFromEv failed:', err.message);
      throw err;
    }
  }

  async function addManualBet(bet) {
    if (!session?.user) { setShowAuth(true); return false; }
    const stake = Number(bet.stake) || 0;
    const odds = Number(bet.odds) || 0;
    if (!bet.match || !bet.outcome || !bet.book || stake <= 0 || odds <= 1) {
      throw new Error('Täytä ottelu, kohde, vedonvälittäjä, kelvollinen kerroin ja panos.');
    }
    try {
      await addUserBet(session.user.id, {
        match: bet.match,
        outcome: bet.outcome,
        book: normalizeBookName(bet.book),
        odds,
        stake,
        edge: Number(bet.edge) || 0,
        market: bet.market || '',
        date: bet.date,
        sourceBetId: null,
        bettorName: bet.bettorName || profile?.username || 'AJ',
      });
      await adjustBookBalance(bet.book, -stake);
      const fresh = await loadUserBets(session.user.id, tierCode);
      setUserBets(fresh);
      if (canAccess(tierCode, 'analytics')) {
        await addBankrollSnapshot(session.user.id, bankroll);
      }
      return true;
    } catch (err) {
      console.warn('[Vedox] addManualBet failed:', err.message);
      throw err;
    }
  }

  async function removeBet(bet) {
    if (!session?.user) return false;
    await deleteUserBet(session.user.id, bet._dbId);
    const returned = returnedAmountForResult(bet.status, bet.odds, bet.stake);
    await adjustBookBalance(bet.book, (bet.stake || 0) - returned);
    setUserBets(prev => prev.filter(b => b._dbId !== bet._dbId));
    return true;
  }

  async function settleBet(bet, result) {
    if (!session?.user) return false;
    await updateUserBetResult(session.user.id, bet._dbId, result, bet.odds, bet.stake);
    const previousReturned = returnedAmountForResult(bet.status, bet.odds, bet.stake);
    const nextReturned = returnedAmountForResult(result, bet.odds, bet.stake);
    await adjustBookBalance(bet.book, nextReturned - previousReturned);
    const fresh = await loadUserBets(session.user.id, tierCode);
    setUserBets(fresh);
    return true;
  }

  async function editBetDate(bet, dateValue) {
    if (!session?.user || !bet?._dbId || String(bet._dbId).startsWith('optimistic-')) return false;
    await updateUserBetDate(session.user.id, bet._dbId, dateValue);
    const fresh = await loadUserBets(session.user.id, tierCode);
    setUserBets(fresh);
    return true;
  }

  async function editBetTerms(bet, nextTerms) {
    if (!session?.user || !bet?._dbId || String(bet._dbId).startsWith('optimistic-')) {
      throw new Error('Veto ei ole vielä valmis muokattavaksi.');
    }
    const allowedResults = new Set(['pending', 'won', 'lost', 'push', 'half_won', 'half_lost']);
    if (!allowedResults.has(bet.status)) throw new Error('Vedon tulostila ei ole kelvollinen.');

    const nextOdds = Number(nextTerms?.odds);
    const nextStake = Number(nextTerms?.stake);
    const nextEv = Number(nextTerms?.ev);
    if (!Number.isFinite(nextOdds) || nextOdds <= 1) throw new Error('Kertoimen pitää olla suurempi kuin 1.');
    if (!Number.isFinite(nextStake) || nextStake <= 0) throw new Error('Panoksen pitää olla suurempi kuin 0.');
    if (!Number.isFinite(nextEv)) throw new Error('Edun pitää olla numero.');

    const oldOdds = Number(bet.odds);
    const oldStake = Number(bet.stake);
    const oldReturned = returnedAmountForResult(bet.status, oldOdds, oldStake);
    const nextReturned = returnedAmountForResult(bet.status, nextOdds, nextStake);
    const balanceDelta = oldStake - oldReturned - nextStake + nextReturned;
    const ownClvOdds = !bet.clvFallbackSource && Number.isFinite(Number(bet.clvOdds)) && Number(bet.clvOdds) > 0
      ? Number(bet.clvOdds)
      : null;
    const nextOwnClvPct = ownClvOdds
      ? Math.round((((nextOdds / ownClvOdds) - 1) * 100) * 100) / 100
      : null;
    const cleanBook = normalizeBookName(bet.book);
    const trackedBalance = bookBalances.find(b => normalizeBookName(b.book) === cleanBook);
    const previousBalance = Number(trackedBalance?.balance) || 0;
    const nextBalance = Math.round((previousBalance + balanceDelta) * 100) / 100;
    if (!trackedBalance && Math.abs(balanceDelta) >= 0.005) {
      throw new Error('Lisää vedon bookmaker Kassat-näkymään ennen panoksen tai tuoton muuttamista.');
    }
    if (trackedBalance && nextBalance < 0) {
      throw new Error('Bookmaker-kassa ei riitä suurempaan panokseen.');
    }

    await updateUserBetTerms(session.user.id, bet._dbId, {
      odds: nextOdds,
      stake: nextStake,
      ev: nextEv,
      returnedAmount: nextReturned,
      expectedOdds: oldOdds,
      expectedStake: oldStake,
      expectedEv: bet.storedEv,
      expectedResult: bet.storedResult,
      expectedSettled: bet.storedSettled,
      expectedClvOdds: ownClvOdds,
      ownClvPct: nextOwnClvPct,
    });

    let savedBalance = null;
    try {
      if (trackedBalance && Math.abs(balanceDelta) >= 0.005) {
        savedBalance = await updateBookBalanceIfUnchanged(session.user.id, cleanBook, {
          expectedBalance: previousBalance,
          expectedUpdatedAt: trackedBalance.updatedAt,
          balance: nextBalance,
        });
      }
    } catch (balanceError) {
      try {
        await updateUserBetTerms(session.user.id, bet._dbId, {
          odds: oldOdds,
          stake: oldStake,
          ev: bet.storedEv,
          returnedAmount: bet.storedReturnedAmount,
          expectedOdds: nextOdds,
          expectedStake: nextStake,
          expectedEv: nextEv,
          expectedResult: bet.storedResult,
          expectedSettled: bet.storedSettled,
          expectedClvOdds: ownClvOdds,
          ownClvPct: ownClvOdds
            ? Math.round((((oldOdds / ownClvOdds) - 1) * 100) * 100) / 100
            : null,
          preserveNulls: true,
        });
      } catch (rollbackError) {
        console.error('[Vedox] bet terms rollback failed:', rollbackError.message);
      }
      throw balanceError;
    }

    if (savedBalance) {
      setBookBalances(prev => {
        const rest = prev.filter(b => normalizeBookName(b.book) !== savedBalance.book);
        return [...rest, savedBalance].sort((a, b) => a.book.localeCompare(b.book));
      });
    }
    const nextClvPct = Number.isFinite(Number(bet.clvOdds)) && Number(bet.clvOdds) > 0
      ? ((nextOdds / Number(bet.clvOdds)) - 1) * 100
      : bet.clvPct;
    setUserBets(prev => prev.map(current => current._dbId === bet._dbId
      ? {
          ...current,
          odds: nextOdds,
          stake: nextStake,
          ev: nextEv,
          storedEv: nextEv,
          returnAmount: nextReturned,
          storedReturnedAmount: nextReturned,
          pnl: bet.status === 'pending' ? null : nextReturned - nextStake,
          clvPct: Number.isFinite(nextClvPct) ? nextClvPct : null,
        }
      : current));
  }

  async function signIn(email, password) {
    const { error } = await sbClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }
  async function signUp(email, password, initialSettings = null) {
    const { data, error } = await sbClient.auth.signUp({ email, password });
    if (error) throw error;
    if (initialSettings && data?.user?.id) {
      localStorage.setItem(`vedox_pending_settings_${data.user.id}`, JSON.stringify(initialSettings));
    }
    return data;
  }
  async function resetPassword(email) {
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
    const { error } = await sbClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }
  async function signOut() { await sbClient.auth.signOut(); }

  // â”€â”€â”€ Enriched ev bets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addedIds = new Set(userBets.map(b => b.sourceBetId).filter(Boolean));

  const evBetsEnriched = evBets.map(b => {
    const tf = formatTime(b.startsAt);
    const taxonomy = deriveBetTaxonomy(b);
    return {
      ...b,
      sport:   taxonomy.sport,
      league:  taxonomy.league,
      day:     tf.day,
      time:    tf.time,
      added:   addedIds.has(String(b.id)),
    };
  });
  const visibleEvBets = evBetsEnriched.filter(b => !b.added);
  const evBetById = new Map(evBetsEnriched.map(b => [String(b.id), b]));
  const evBetByMatch = new Map();
  evBetsEnriched.forEach(b => {
    const key = String(b.match || '').toLowerCase();
    if (key && !evBetByMatch.has(key)) evBetByMatch.set(key, b);
  });
  const hiddenBookSet = new Set(hiddenBookBalanceBooks.map(normalizeBookName));
  const bookBalanceMap = new Map();
  bookBalances.forEach(b => {
    const book = normalizeBookName(b.book);
    if (!book || hiddenBookSet.has(book)) return;
    bookBalanceMap.set(book, (bookBalanceMap.get(book) || 0) + (Number(b.balance) || 0));
  });
  const bookBalanceSuggestions = Array.from(new Set([
    ...DEFAULT_BOOK_BALANCE_BOOKS,
    ...bookBalances.map(b => normalizeBookName(b.book)),
    ...evBetsEnriched.map(b => normalizeBookName(b.book)),
    ...userBets.map(b => normalizeBookName(b.book)),
  ].map(normalizeBookName).filter(Boolean))).sort();
  const booksForBalances = bookBalanceSuggestions.filter(book => !hiddenBookSet.has(normalizeBookName(book)));

  // â”€â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const updatedAgo = lastUpdated ? (() => {
    const s = Math.round((Date.now() - lastUpdated) / 1000);
    return s < 60 ? `${s} s sitten` : `${Math.round(s / 60)} min sitten`;
  })() : '-';

  const edgeHistogram = (() => {
    const bins = new Array(9).fill(0);
    visibleEvBets.forEach(b => {
      const i = Math.min(Math.max(Math.floor(b.edge - 2), 0), 8);
      bins[i]++;
    });
    return bins;
  })();

  const settledBets = userBets.filter(b => b.status !== 'pending');
  const wonBets     = settledBets.filter(b => b.status === 'won' || b.status === 'half_won');
  const totalPnl    = settledBets.reduce((a, b) => a + (b.pnl || 0), 0);
  const totalStaked = settledBets.reduce((a, b) => a + b.stake, 0);
  const roi         = totalStaked > 0 ? (totalPnl / totalStaked) * 100 : 0;
  const hitRate     = settledBets.length > 0 ? (wonBets.length / settledBets.length) * 100 : 0;
  const bestEdge    = visibleEvBets.length ? Math.max(...visibleEvBets.map(b => b.edge)) : 0;
  const avgEdge     = visibleEvBets.length ? visibleEvBets.reduce((a, b) => a + b.edge, 0) / visibleEvBets.length : 0;
  const totalBookBalance = Math.round(Array.from(bookBalanceMap.values()).reduce((a, v) => a + (Number(v) || 0), 0) * 100) / 100;
  const hasBookBalances = totalBookBalance > 0;

  const stats = {
    arvovedot:    visibleEvBets.length,
    varmavedot:   arbitrages.length,
    omatAvoimet:  userBets.filter(b => b.status === 'pending').length,
    omatYht:      userBets.length,
    parasEtu:     bestEdge > 0 ? `+${bestEdge.toFixed(1)} %` : '-',
    keskietu:     avgEdge > 0  ? `+${avgEdge.toFixed(1)} %`  : '-',
    paivitetty:   updatedAgo,
    roi30:        roi.toFixed(1),
    hitRate:      hitRate.toFixed(1),
    edgeHistogram,
  };

  // â”€â”€â”€ User bets formatted â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const userBetsFormatted = userBets.map(b => {
    const source = b.sourceBetId ? evBetById.get(String(b.sourceBetId)) : null;
    const taxonomy = deriveBetTaxonomy(b, source);
    return {
      ...b,
      date: b.date || '',
      dateValue: b.dateValue,
      pick:       b.outcome,
      statusLabel: b.status === 'won'  ? 'Voitto'
                 : b.status === 'lost' ? 'Tappio'
                 : b.status === 'push' ? 'Palautus'
                 : b.status === 'half_won' ? 'Half win'
                 : b.status === 'half_lost' ? 'Half loss'
                 : 'Odottaa',
      sport: taxonomy.sport,
      league: taxonomy.league,
      taxonomyStatus: taxonomy.taxonomyStatus,
      taxonomyReason: b.taxonomyReason || taxonomy.taxonomyReason,
      pnl: b.pnl ?? 0,
    };
  });

  // â”€â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sportCounts = {};
  const sportAgg = {};
  userBets.forEach(b => {
    const source = b.sourceBetId ? evBetById.get(String(b.sourceBetId)) : null;
    const matchSource = evBetByMatch.get(String(b.match || '').toLowerCase());
    const s = deriveBetTaxonomy(b, source || matchSource || null).sport;
    sportCounts[s] = (sportCounts[s] || 0) + 1;
    if (b.status !== 'pending') {
      if (!sportAgg[s]) sportAgg[s] = { sport: s, pnl: 0, stake: 0, n: 0 };
      sportAgg[s].pnl += b.pnl || 0;
      sportAgg[s].stake += b.stake || 0;
      sportAgg[s].n += 1;
    }
  });
  const total = userBets.length || 1;
  const sportSplit = Object.entries(sportCounts)
    .map(([sport, n]) => ({ sport, pct: Math.round(n / total * 100), n }))
    .sort((a, b) => b.n - a.n);

  const pnlArray = userBetsFormatted
    .filter(b => b.statusLabel !== 'Odottaa')
    .slice(0, 30)
    .reverse()
    .map(b => b.pnl);
  const bankrollArray = (() => {
    if (bankroll <= 0) return [];
    if (!pnlArray.length) return [bankroll];
    const points = [bankroll];
    pnlArray.forEach(v => points.push(points[points.length - 1] + v));
    return points;
  })();
  const resultBankroll = bankroll > 0 ? bankroll + totalPnl : 0;
  const currentBankroll = hasBookBalances ? totalBookBalance : resultBankroll;
  const effectiveFlatStake = stakeMode === 'percent'
    ? Math.max(0, Math.round((currentBankroll * (stakePct || 1) / 100) * 100) / 100)
    : flatStake;

  const analytics = {
    pnlPerBet: pnlArray,
    sportSplit,
    roiBySport: Object.values(sportAgg)
      .map(s => ({ ...s, ev: s.stake > 0 ? (s.pnl / s.stake) * 100 : 0 }))
      .sort((a, b) => b.ev - a.ev),
    summary: { totalPnl, roi30: roi, hitRate, avgEdge, settledCount: settledBets.length, currentBankroll },
  };

  return (
    <Ctx.Provider value={{
      session, authReady, permissionsReady, showAuth, setShowAuth, signIn, signUp, resetPassword, signOut,
      profile, tierCode,
      tierLabel: tierLabel(tierCode),
      canAccess: (pageId) => canAccess(tierCode, pageId),
      bankroll: currentBankroll,
      baseBankroll: bankroll,
      setBankroll,
      flatStake: effectiveFlatStake,
      fixedFlatStake: flatStake,
      setFlatStake,
      stakeMode, setStakeMode,
      stakePct, setStakePct,
      kellyFraction, setKellyFraction,
      lang, setLang,
      settingsSaveStatus, settingsSaveError,
      evBets: evBetsEnriched,
      arbitrages,
      userBets: userBetsFormatted,
      bookBalances,
      bookBalanceMap,
      booksForBalances,
      bookBalanceSuggestions,
      totalBookBalance,
      setBookBalance,
      addBookBalanceBook,
      removeBookBalanceBook,
      bankrollArray, pnlArray,
      stats, analytics,
      loading,
      addedIds,
      addBetFromEv, addManualBet, removeBet, settleBet, editBetDate, editBetTerms,
      refreshEvBets: () => refreshEvData(tierCode),
    }}>
      {children}
    </Ctx.Provider>
  );
}

