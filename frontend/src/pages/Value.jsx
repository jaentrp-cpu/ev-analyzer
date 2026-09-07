import React, { useEffect, useState } from 'react';
import { useVedox } from '../context/VedoxContext.jsx';
import { Icon, initials } from '../components/Icon.jsx';
import DatePicker from '../components/DatePicker.jsx';
import LockedView from '../components/LockedView.jsx';
import LoadingView from '../components/LoadingView.jsx';
import { calculateKellyStake, formatKellyFraction, KELLY_MAX_BET_PCT } from '../staking.js';
import { formatSteamScore100, sbClient } from '../supabase.js';
import { applyValueBetSkipEvent, createValueBetSkipStore } from '../value-bet-skips.js';

const EURO = '\u20ac';
const valueBetSkipStore = createValueBetSkipStore(sbClient);

function startsInDateRange(startsAt, timeFilter, from, to) {
  if (timeFilter === 'all' || !startsAt) return true;
  const starts = new Date(startsAt).getTime();
  if (!Number.isFinite(starts)) return true;
  const now = Date.now();
  const startDay = new Date(starts);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todayEnd = todayStart + 864e5 - 1;
  if (timeFilter === 'today') return starts >= todayStart && starts <= todayEnd;
  const hours = (starts - now) / 36e5;
  if (timeFilter === '24h') return hours >= 0 && hours <= 24;
  if (timeFilter === '3d') return hours >= 0 && hours <= 72;
  if (timeFilter === '7d') return hours >= 0 && hours <= 168;
  if (timeFilter === 'custom') {
    const fromOk = from ? starts >= new Date(`${from}T00:00:00`).getTime() : true;
    const toOk = to ? starts <= new Date(`${to}T23:59:59`).getTime() : true;
    return fromOk && toOk;
  }
  return Number.isFinite(startDay.getTime());
}

function adjustedValueBet(bet, edit, defaultStake, staking = {}) {
  const originalOdds = Number(bet.odds) || 0;
  const originalEdge = Number(bet.edge) || 0;
  const editedOdds = Number(edit?.odds);
  const editedStake = Number(edit?.stake);
  const hasStakeEdit = Object.prototype.hasOwnProperty.call(edit || {}, 'stake');
  const hasManualStakeOverride = staking.mode === 'kelly' && edit?.stakeOverride === true;
  const odds = editedOdds > 1 ? editedOdds : originalOdds;
  const fairOdds = originalEdge > -99 && originalOdds > 1
    ? originalOdds / (1 + originalEdge / 100)
    : 0;
  const fairProb = fairOdds > 1 ? 1 / fairOdds : 0;
  const edge = fairProb > 0 ? ((odds * fairProb) - 1) * 100 : originalEdge;
  const modelStake = staking.mode === 'kelly'
    ? calculateKellyStake({
        bankroll: staking.bankroll,
        originalOdds,
        originalEdgePct: originalEdge,
        effectiveOdds: odds,
        fraction: staking.kellyFraction,
        maxBetPct: KELLY_MAX_BET_PCT,
      })
    : defaultStake;
  const stake = staking.mode === 'kelly'
    ? hasManualStakeOverride
      ? Number.isFinite(editedStake) ? editedStake : 0
      : modelStake
    : hasStakeEdit
      ? Number.isFinite(editedStake) ? editedStake : 0
      : modelStake;
  return {
    odds,
    stake,
    edge,
    fairOdds,
    kellyStake: staking.mode === 'kelly' ? modelStake : null,
    hasManualStakeOverride,
  };
}

function kellyStakeCap(bankroll) {
  const safeBankroll = Number(bankroll);
  if (!Number.isFinite(safeBankroll) || safeBankroll <= 0) return 0;
  return Math.floor((safeBankroll * KELLY_MAX_BET_PCT / 100) * 100) / 100;
}

function valueBetStakeError(calc, edit, staking = {}) {
  if (staking.mode !== 'kelly') {
    return Number.isFinite(Number(calc.stake)) && Number(calc.stake) > 0
      ? ''
      : 'Panoksen pit\u00e4\u00e4 olla suurempi kuin 0.';
  }

  const safeBankroll = Number(staking.bankroll);
  if (!Number.isFinite(safeBankroll) || safeBankroll <= 0) {
    return 'Aseta pelikassa profiilissa ennen Kelly-panoksen k\u00e4ytt\u00e4mist\u00e4.';
  }

  const cap = kellyStakeCap(safeBankroll);
  if (cap < 0.01) {
    return 'Pelikassan 5 % panoskatto on alle 0,01 \u20ac.';
  }

  if (calc.hasManualStakeOverride) {
    const rawStake = String(edit?.stake ?? '').trim();
    const manualStake = Number(rawStake);
    if (!rawStake || !Number.isFinite(manualStake) || manualStake < 0.01) {
      return 'Manuaalisen panoksen pit\u00e4\u00e4 olla v\u00e4hint\u00e4\u00e4n 0,01 \u20ac.';
    }
    if (manualStake > cap) {
      return `Manuaalinen panos saa olla enint\u00e4\u00e4n ${cap.toFixed(2)} \u20ac (5 % kassasta).`;
    }
    return '';
  }

  return Number(calc.kellyStake) > 0
    ? ''
    : 'Kelly ei suosittele t\u00e4lle kohteelle panosta.';
}

function ValueOddsEditor({ bet, edit, calc, onChange }) {
  return (
    <span className="o-cell editable-odds value-odds-editor">
      <input
        type="number"
        min="1.01"
        step="0.01"
        value={edit.odds ?? Number(bet.odds).toFixed(2)}
        onChange={event => onChange(event.target.value)}
        aria-label="Muokkaa kerrointa"
      />
      <span className="fair">&#8776; {calc.fairOdds > 0 ? calc.fairOdds.toFixed(2) : '-'}</span>
    </span>
  );
}

function ValueStakeEditor({
  calc,
  edit,
  stakeMode,
  bankroll,
  error,
  onChange,
  onResetKelly,
}) {
  const cap = kellyStakeCap(bankroll);
  const inputValue = stakeMode === 'kelly'
    ? calc.hasManualStakeOverride ? edit.stake ?? '' : Number(calc.kellyStake || 0).toFixed(2)
    : edit.stake ?? Number(calc.stake || 0).toFixed(2);

  return (
    <div className={'value-stake-editor' + (error ? ' has-error' : '')}>
      <input
        className="stake-inline"
        type="number"
        min="0.01"
        max={stakeMode === 'kelly' && cap > 0 ? cap : undefined}
        step="0.01"
        value={inputValue}
        onChange={event => onChange(event.target.value)}
        title={stakeMode === 'kelly'
          ? `Kelly-ehdotus ${Number(calc.kellyStake || 0).toFixed(2)} \u20ac, enint\u00e4\u00e4n 5 % kassasta`
          : 'Muokkaa panosta'}
        aria-label="Muokkaa panosta"
        aria-invalid={Boolean(error)}
      />
      {stakeMode === 'kelly' && (
        <div className="value-kelly-meta">
          <span>
            Kelly {Number(calc.kellyStake || 0).toFixed(2)} {EURO}
            {cap > 0 ? ` \u00b7 katto ${cap.toFixed(2)} ${EURO}` : ''}
          </span>
          {calc.hasManualStakeOverride && (
            <button type="button" className="value-kelly-reset" onClick={onResetKelly}>
              Palauta Kellyyn
            </button>
          )}
        </div>
      )}
      {error && <small className="value-stake-error" role="alert">{error}</small>}
    </div>
  );
}

function startsToday(startsAt) {
  if (!startsAt) return false;
  const starts = new Date(startsAt).getTime();
  if (!Number.isFinite(starts)) return false;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todayEnd = todayStart + 864e5 - 1;
  return starts >= todayStart && starts <= todayEnd;
}

function steamGradeClass(grade) {
  if (grade === 'A' || grade === 'A+' || grade === 'A-') return ' high';
  if (grade === 'B' || grade === 'B+' || grade === 'B-') return ' good';
  if (grade === 'C' || grade === 'C+' || grade === 'C-') return ' watch';
  if (grade === 'D') return ' low';
  return '';
}

export default function Value() {
  const { evBets, stats, loading, addBetFromEv, refreshEvBets,
          session, authReady, permissionsReady, setShowAuth, flatStake, bankroll, canAccess,
          bookBalanceMap, stakeMode, kellyFraction } = useVedox();
  const [sportFilter, setSportFilter] = useState(() => localStorage.getItem('vedox_value_sport') || 'Kaikki');
  const [leagueFilter, setLeagueFilter] = useState(() => localStorage.getItem('vedox_value_league') || 'Kaikki');
  const [bookFilter, setBookFilter] = useState(() => localStorage.getItem('vedox_value_book') || 'Kaikki');
  const [minEdge, setMinEdge] = useState(() => localStorage.getItem('vedox_value_min_edge') || '0');
  const [timeFilter, setTimeFilter] = useState(() => localStorage.getItem('vedox_value_time') || 'all');
  const [dateFrom, setDateFrom] = useState(() => localStorage.getItem('vedox_value_date_from') || '');
  const [dateTo, setDateTo] = useState(() => localStorage.getItem('vedox_value_date_to') || '');
  const [betEdits, setBetEdits] = useState({});
  const [betActionState, setBetActionState] = useState({});
  const [showSkipped, setShowSkipped] = useState(false);
  const [skippedIds, setSkippedIds] = useState([]);
  const [skipError, setSkipError] = useState('');

  useEffect(() => { localStorage.setItem('vedox_value_sport', sportFilter); }, [sportFilter]);
  useEffect(() => { localStorage.setItem('vedox_value_league', leagueFilter); }, [leagueFilter]);
  useEffect(() => { localStorage.setItem('vedox_value_book', bookFilter); }, [bookFilter]);
  useEffect(() => { localStorage.setItem('vedox_value_min_edge', minEdge); }, [minEdge]);
  useEffect(() => { localStorage.setItem('vedox_value_time', timeFilter); }, [timeFilter]);
  useEffect(() => { localStorage.setItem('vedox_value_date_from', dateFrom); }, [dateFrom]);
  useEffect(() => { localStorage.setItem('vedox_value_date_to', dateTo); }, [dateTo]);

  useEffect(() => {
    const userId = session?.user?.id;
    setSkippedIds([]);
    setSkipError('');
    localStorage.removeItem('vedox_value_skipped_ids');
    localStorage.removeItem('vedox_value_bettor_name');
    if (!userId) return undefined;

    let active = true;
    valueBetSkipStore.load(userId)
      .then(ids => { if (active) setSkippedIds(ids); })
      .catch(error => {
        if (!active) return;
        console.warn('[Vedox] value-bet skips load failed:', error.message);
        setSkipError('Ohitusten lataus ep\u00e4onnistui. Yrit\u00e4 p\u00e4ivitt\u00e4\u00e4 sivu.');
      });
    const unsubscribe = valueBetSkipStore.subscribe(userId, payload => {
      if (active) setSkippedIds(current => applyValueBetSkipEvent(current, payload, userId));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [session?.user?.id]);

  const setBetEdit = (betId, patch) => {
    setBetEdits(prev => ({
      ...prev,
      [betId]: { ...(prev[betId] || {}), ...patch },
    }));
    setBetActionState(prev => {
      if (!prev[betId]?.error) return prev;
      return { ...prev, [betId]: { ...prev[betId], error: '' } };
    });
  };

  const resetKellyStake = (betId) => {
    setBetEdits(prev => ({
      ...prev,
      [betId]: {
        ...(prev[betId] || {}),
        stake: undefined,
        stakeOverride: false,
      },
    }));
    setBetActionState(prev => {
      if (!prev[betId]?.error) return prev;
      return { ...prev, [betId]: { ...prev[betId], error: '' } };
    });
  };

  const skipValueBet = async (betId) => {
    const userId = session?.user?.id;
    if (!userId) return;
    const normalizedId = String(betId);
    setSkipError('');
    setSkippedIds(current => Array.from(new Set([...current, normalizedId])));
    try {
      await valueBetSkipStore.add(userId, normalizedId);
    } catch (error) {
      setSkippedIds(current => current.filter(id => id !== normalizedId));
      console.warn('[Vedox] value-bet skip save failed:', error.message);
      setSkipError('Ohituksen tallennus ep\u00e4onnistui. Yrit\u00e4 uudelleen.');
    }
  };

  const clearValueBetSkips = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const previous = skippedIds;
    setSkipError('');
    setSkippedIds([]);
    try {
      await valueBetSkipStore.clear(userId);
    } catch (error) {
      setSkippedIds(previous);
      console.warn('[Vedox] value-bet skips clear failed:', error.message);
      setSkipError('Ohitusten tyhjennys ep\u00e4onnistui. Yrit\u00e4 uudelleen.');
    }
  };

  if (!authReady || (session && !permissionsReady && evBets.length === 0)) {
    return <LoadingView title="Arvovedot" />;
  }

  if (!session || !canAccess('value')) {
    return <LockedView pageId="value" session={session} setShowAuth={setShowAuth} />;
  }

  const skippedSet = new Set(skippedIds);
  const availableBets = evBets.filter(b => !b.added && (showSkipped || !skippedSet.has(String(b.id))));
  const skippedCount = evBets.filter(b => skippedSet.has(String(b.id))).length;
  const sports = ['Kaikki', ...Array.from(new Set(availableBets.map(b => b.sport).filter(Boolean))).sort()];
  const leagues = ['Kaikki', ...Array.from(new Set(availableBets.map(b => b.league).filter(Boolean))).sort()];
  const books = ['Kaikki', ...Array.from(new Set(availableBets.map(b => b.book).filter(Boolean))).sort()];
  const filtered = availableBets.filter(b =>
    (sportFilter === 'Kaikki' || b.sport === sportFilter) &&
    (leagueFilter === 'Kaikki' || b.league === leagueFilter) &&
    (bookFilter === 'Kaikki' || b.book === bookFilter) &&
    b.edge >= Number(minEdge || 0) &&
    startsInDateRange(b.startsAt, timeFilter, dateFrom, dateTo)
  );
  const adjustedFiltered = filtered.map(b => ({
    bet: b,
    calc: adjustedValueBet(b, betEdits[b.id], flatStake, {
      mode: stakeMode,
      bankroll,
      kellyFraction,
    }),
  }));
  const counts = { Kaikki: availableBets.length };
  sports.slice(1).forEach(s => { counts[s] = availableBets.filter(b => b.sport === s).length; });

  const getValueBetState = (bet) => {
    const edit = betEdits[bet.id] || {};
    const calc = adjustedValueBet(bet, edit, flatStake, {
      mode: stakeMode,
      bankroll,
      kellyFraction,
    });
    const stakeError = valueBetStakeError(calc, edit, {
      mode: stakeMode,
      bankroll,
    });
    const bookBalance = bookBalanceMap.get(bet.book);
    const hasBalance = Number.isFinite(Number(bookBalance));
    return {
      edit,
      calc,
      stakeError,
      bookBalance,
      hasBalance,
      lowBalance: hasBalance && Number(bookBalance) < Number(calc.stake || 0),
      stillValue: calc.edge > 0,
      isSkipped: skippedSet.has(String(bet.id)),
      adding: Boolean(betActionState[bet.id]?.adding),
      actionError: betActionState[bet.id]?.error || '',
    };
  };

  const addValueBet = async (bet, rowState) => {
    if (rowState.stakeError || !rowState.stillValue || rowState.adding || bet.added) {
      if (rowState.stakeError) {
        setBetActionState(prev => ({
          ...prev,
          [bet.id]: { adding: false, error: rowState.stakeError },
        }));
      }
      return;
    }

    setBetActionState(prev => ({
      ...prev,
      [bet.id]: { adding: true, error: '' },
    }));
    try {
      const result = await addBetFromEv({
        ...bet,
        odds: rowState.calc.odds,
        edge: rowState.calc.edge,
        stake: rowState.calc.stake,
      });
      if (result === false) {
        throw new Error('Vetoa ei voitu lis\u00e4t\u00e4 omiin vetoihin.');
      }
      setBetActionState(prev => ({
        ...prev,
        [bet.id]: { adding: false, error: '' },
      }));
    } catch (error) {
      setBetActionState(prev => ({
        ...prev,
        [bet.id]: {
          adding: false,
          error: error?.message || 'Vedon lis\u00e4\u00e4minen ep\u00e4onnistui.',
        },
      }));
    }
  };

  const pottipanos = adjustedFiltered.reduce((a, row) => a + (Number.isFinite(Number(row.calc.stake)) ? Number(row.calc.stake) : 0), 0);
  const mahdTuotto = adjustedFiltered.reduce((a, row) => {
    const stake = Number.isFinite(Number(row.calc.stake)) ? Number(row.calc.stake) : 0;
    return a + stake * (row.calc.odds - 1);
  }, 0);
  const ev = adjustedFiltered.reduce((a, row) => {
    const stake = Number.isFinite(Number(row.calc.stake)) ? Number(row.calc.stake) : 0;
    return a + stake * (row.calc.edge / 100);
  }, 0);
  const bookBalanceTotal = Array.from(bookBalanceMap.values()).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const stakeBase = bookBalanceTotal > 0 ? bookBalanceTotal : bankroll;
  const kassaPct = stakeBase > 0 ? ((pottipanos / stakeBase) * 100).toFixed(1) : '-';
  const todaysUpcomingBets = availableBets.filter(b => startsToday(b.startsAt));
  const todaysEdges = todaysUpcomingBets.length ? todaysUpcomingBets.map(b => Number(b.edge) || 0) : availableBets.map(b => Number(b.edge) || 0);
  const edgeBins = new Array(12).fill(0);
  todaysEdges.forEach(edge => {
    const idx = Math.min(Math.max(Math.floor(edge - 2), 0), edgeBins.length - 1);
    edgeBins[idx] += 1;
  });
  const edgeMedian = (() => {
    if (!todaysEdges.length) return 0;
    const sorted = [...todaysEdges].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  })();

  return (
    <div className="page-body">
      <div className="ph">
        <div>
          <h1>Arvovedot</h1>
          <div className="sub">{filtered.length} kohdetta vastaa kriteereit&auml;si &middot; p&auml;ivitetty {stats.paivitetty}</div>
        </div>
        <div className="actions">
          <button className="btn p refresh-btn" onClick={refreshEvBets} disabled={loading}>
            {loading ? 'P\u00e4ivitet\u00e4\u00e4n...' : 'P\u00e4ivit\u00e4'}
          </button>
        </div>
      </div>

      <div className="val-head">
        <div className="stat-grid val-stats">
          <div className="s"><div className="l">Kohteet</div><div className="v">{stats.arvovedot}</div><div className="d">{filtered.length} n&auml;ytett&auml;v&auml;n&auml;</div></div>
          <div className="s"><div className="l">Paras etu</div><div className="v g">{stats.parasEtu}</div><div className="d">-</div></div>
          <div className="s"><div className="l">Keskietu</div><div className="v">{stats.keskietu}</div><div className="d">kaikki kohteet</div></div>
          <div className="s"><div className="l">P&auml;ivitetty</div><div className="v" style={{ fontSize: 15, marginTop: 8 }}>{stats.paivitetty}</div></div>
        </div>

        <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Pottipanos</span>
            {bankroll > 0 && <span style={{ color: 'var(--blue)' }}>{kassaPct} % pelikassasta</span>}
          </div>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 32, fontWeight: 600, letterSpacing: '-.035em', marginTop: 8 }}>{pottipanos.toFixed(2)} {EURO}</div>
          <div style={{ fontSize: 11.5, color: 'var(--tx3)', marginTop: 2 }}>
            Jaettu {filtered.length} kohteelle &middot; {stakeMode === 'kelly'
              ? `Kelly ${formatKellyFraction(kellyFraction)} · enintään ${KELLY_MAX_BET_PCT} % kassasta / veto`
              : `${flatStake} ${EURO} per veto`}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span><span style={{ color: 'var(--tx3)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Mahd. tuotto </span>+{mahdTuotto.toFixed(2)} {EURO}</span>
            <span><span style={{ color: 'var(--tx3)', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>EV </span><span style={{ color: 'var(--green)' }}>+{ev.toFixed(2)} {EURO}</span></span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Edun jakauma &middot; t&auml;n&auml;&auml;n</span>
            <span>{todaysEdges.length} kohdetta</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, marginTop: 10 }}>
            {edgeBins.map((h, i) => (
              <div key={i} style={{ flex: 1, background: 'var(--blue-soft)', borderTop: '2px solid var(--blue)', height: `${Math.max(h * 6, 2)}px`, borderRadius: '2px 2px 0 0' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--tx3)', marginTop: 6 }}>
            <span>2%</span><span>4%</span><span>6%</span><span>8%</span><span>10%+</span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 10, fontSize: 11.5, color: 'var(--tx3)' }}>
            Mediaani <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{edgeMedian.toFixed(1)} %</span>
          </div>
        </div>
      </div>

      <div className="filters">
        {sports.map(s => (
          <span key={s} className={'chip' + (sportFilter === s ? ' on' : '')} onClick={() => setSportFilter(s)}>
            {s}<span className="ct">{counts[s] || 0}</span>
          </span>
        ))}
        <span className="vsep" />
        <label className="filter-field">
          <span>Liiga</span>
          <select value={leagueFilter} onChange={e => setLeagueFilter(e.target.value)}>
            {leagues.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Bookkeri</span>
          <select value={bookFilter} onChange={e => setBookFilter(e.target.value)}>
            {books.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="filter-field narrow">
          <span>Min. etu</span>
          <select value={minEdge} onChange={e => setMinEdge(e.target.value)}>
            <option value="0">0 %</option>
            <option value="2">2 %</option>
            <option value="4">4 %</option>
            <option value="6">6 %</option>
          </select>
        </label>
        <label className="filter-field narrow">
          <span>Aika</span>
          <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
            <option value="all">Kaikki</option>
            <option value="today">T&auml;n&auml;&auml;n</option>
            <option value="24h">24 h</option>
            <option value="3d">3 vrk</option>
            <option value="7d">7 vrk</option>
            <option value="custom">P&auml;iv&auml;m&auml;&auml;r&auml;</option>
          </select>
        </label>
        {timeFilter === 'custom' && (
          <>
            <label className="filter-field date"><span>Alkaen</span><DatePicker value={dateFrom} onChange={setDateFrom} /></label>
            <label className="filter-field date"><span>Asti</span><DatePicker value={dateTo} onChange={setDateTo} /></label>
          </>
        )}
        <div style={{ flex: 1 }} />
        <button className={'chip action' + (showSkipped ? ' on' : '')} onClick={() => setShowSkipped(v => !v)}>
          {showSkipped ? 'Piilota ohitetut' : `N\u00e4yt\u00e4 ohitetut${skippedCount ? ` ${skippedCount}` : ''}`}
        </button>
        {skippedCount > 0 && (
          <button className="chip action" onClick={clearValueBetSkips}>Tyhjenn\u00e4 ohitukset</button>
        )}
        {skipError && <small className="value-action-error" role="alert">{skipError}</small>}
      </div>

      <div className="card val-table">
        <div className="card-head">
          <h3>Aktiiviset arvovedot</h3>
          <div className="info"><span>{filtered.length} / {availableBets.length} n&auml;ytet&auml;&auml;n</span></div>
        </div>
        <div className="scroll value-desktop">
          {filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--tx3)' }}>
              {loading ? 'Ladataan...' : 'Ei arvovetoja juuri nyt'}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Ottelu / kohde</th>
                  <th style={{ width: 96 }}>Aika</th>
                  <th className="r" style={{ width: 140 }}>Kerroin &middot; reilu</th>
                  <th style={{ width: 96 }}>Kirja</th>
                  <th className="r" style={{ width: 86 }}>Saldo</th>
                  <th className="r" style={{ width: 90 }}>Etu</th>
                  <th className="r" style={{ width: 84 }}>Steam</th>
                  <th className="r" style={{ width: 80 }}>Panos</th>
                  <th className="r" style={{ width: 130 }}>Toiminnot</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => {
                  const rowState = getValueBetState(b);
                  const {
                    edit,
                    calc,
                    bookBalance,
                    isSkipped,
                    hasBalance,
                    lowBalance,
                    stillValue,
                    stakeError,
                    adding,
                    actionError,
                  } = rowState;
                  const addDisabled = b.added || Boolean(stakeError) || !stillValue || adding;
                  return (
                    <tr key={i}>
                      <td>
                        <div className="matchcol">
                          <div className={'av-sq' + (b.edge >= 5 ? ' b' : '')}>{initials(b.match)}</div>
                          <div>
                            <div className="m">{b.match}</div>
                            <div className="sub">
                              <span>{b.league}</span><span className="d" />
                              <span>{b.sport}</span><span className="d" />
                              <span className="pk">{b.outcome}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td><div className="timeblock"><div className="t">{b.time}</div><div className="d">{b.day}</div></div></td>
                      <td className="r">
                        <ValueOddsEditor
                          bet={b}
                          edit={edit}
                          calc={calc}
                          onChange={value => setBetEdit(b.id, { odds: value })}
                        />
                      </td>
                      <td><span style={{ color: 'var(--blue)', fontSize: 12.5, fontWeight: 500 }}>{b.book}</span></td>
                      <td className="r" style={{ fontFamily: 'monospace', fontWeight: 600, color: lowBalance ? 'var(--red)' : 'var(--tx)' }}>{hasBalance ? `${Number(bookBalance).toFixed(2)} ${EURO}` : '-'}</td>
                      <td className="r">
                        <span className={'edge-pill' + (calc.edge >= 6 ? ' hi' : '') + (!stillValue ? ' bad' : '')}>
                          {calc.edge >= 0 ? '+' : ''}{calc.edge.toFixed(1)}%{b.evMarker || ''}
                        </span>
                      </td>
                      <td className="r">
                        {b.steamDisplayScore != null && Number.isFinite(Number(b.steamDisplayScore)) ? (
                          <span
                            className={'steam-pill' + steamGradeClass(b.steamDisplayGrade)}
                            title={[
                              b.steamDisplaySource === 'steam_rating_rules'
                                ? `Opittu Steam-rating ${formatSteamScore100(b.steamDisplayScore)}`
                                : `Reaaliaikainen Steam-signaali ${Number(b.legacySteamScore).toFixed(1)}/58 → ${formatSteamScore100(b.steamDisplayScore)}`,
                              b.steamDisplayLabel,
                              b.steamRuleValue != null && b.steamLiveAdjustment != null
                                ? `solu ${formatSteamScore100(b.steamRuleValue)} · kohdekohtainen muutos ${Number(b.steamLiveAdjustment) >= 0 ? '+' : ''}${Number(b.steamLiveAdjustment).toFixed(1)}`
                                : '',
                              b.steamLabels != null && Number.isFinite(Number(b.steamLabels)) ? `${b.steamLabels} opetuslabelia` : '',
                              b.steamAvgClv != null && Number.isFinite(Number(b.steamAvgClv)) ? `säännön AVG CLV ${Number(b.steamAvgClv).toFixed(2)} %` : '',
                            ].filter(Boolean).join(' · ')}
                          >
                            <span>{b.steamDisplayGrade || 'Steam'}</span>
                            <small>{formatSteamScore100(b.steamDisplayScore)}</small>
                          </span>
                        ) : b.steamUnscorable ? (
                          <span
                            className="steam-empty"
                            title="Steam V1 ei keksi fallback-arvoa: vähintään yksi pakollinen mallisyöte puuttuu."
                          >
                            Tarkista
                          </span>
                        ) : (
                          <span className="steam-empty" title="Steam-signaalia ei ole saatavilla">-</span>
                        )}
                      </td>
                      <td className="r">
                        <ValueStakeEditor
                          calc={calc}
                          edit={edit}
                          stakeMode={stakeMode}
                          bankroll={bankroll}
                          error={stakeError}
                          onChange={value => setBetEdit(b.id, {
                            stake: value,
                            stakeOverride: stakeMode === 'kelly',
                          })}
                          onResetKelly={() => resetKellyStake(b.id)}
                        />
                      </td>
                      <td className="r">
                        <div className="row-acts">
                          <button
                            className="ib ghost"
                            onClick={() => skipValueBet(b.id)}
                            disabled={isSkipped}
                            title="Piilota t\u00e4m\u00e4 kohde t\u00e4lt\u00e4 k\u00e4ytt\u00e4j\u00e4tililt\u00e4"
                          >
                            {isSkipped ? 'Ohitettu' : 'Ohita'}
                          </button>
                          <button
                            className={'ib' + (addDisabled ? '' : ' p')}
                            disabled={addDisabled}
                            onClick={() => addValueBet(b, rowState)}
                            style={{ opacity: addDisabled ? 0.5 : 1, cursor: addDisabled ? 'default' : 'pointer', fontSize: 11 }}
                            title={stakeError
                              ? stakeError
                              : stillValue
                                ? 'Lisää omiin vetoihin muokatulla panoksella ja kertoimella'
                                : 'Muokatulla kertoimella etu ei ole enää positiivinen'}
                          >
                            {b.added
                              ? 'Lis\u00e4tty'
                              : adding
                                ? 'Lis\u00e4t\u00e4\u00e4n...'
                                : <><Icon name="add" size={11} />Lis&auml;&auml;</>}
                          </button>
                          {actionError && <small className="value-action-error" role="alert">{actionError}</small>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="value-mobile" aria-label="Aktiiviset arvovedot mobiilissa">
          {filtered.length === 0 ? (
            <div className="value-mobile-empty">
              {loading ? 'Ladataan...' : 'Ei arvovetoja juuri nyt'}
            </div>
          ) : filtered.map((b) => {
            const rowState = getValueBetState(b);
            const {
              edit,
              calc,
              bookBalance,
              hasBalance,
              lowBalance,
              stillValue,
              isSkipped,
              stakeError,
              adding,
              actionError,
            } = rowState;
            const addDisabled = b.added || Boolean(stakeError) || !stillValue || adding;
            return (
              <article className="value-mobile-card" key={`mobile-${b.id}`}>
                <div className="value-mobile-card-head">
                  <div className={'av-sq' + (b.edge >= 5 ? ' b' : '')}>{initials(b.match)}</div>
                  <div className="value-mobile-title">
                    <strong>{b.match}</strong>
                    <span>{b.league} &middot; {b.sport}</span>
                  </div>
                  <span className={'edge-pill' + (calc.edge >= 6 ? ' hi' : '') + (!stillValue ? ' bad' : '')}>
                    {calc.edge >= 0 ? '+' : ''}{calc.edge.toFixed(1)}%{b.evMarker || ''}
                  </span>
                </div>

                <div className="value-mobile-pick">{b.outcome}</div>
                <div className="value-mobile-meta">
                  <span>{b.day} {b.time}</span>
                  <span>{b.book}</span>
                  <span className={lowBalance ? 'bad' : ''}>
                    Saldo {hasBalance ? `${Number(bookBalance).toFixed(2)} ${EURO}` : '-'}
                  </span>
                  <span>
                    Steam {b.steamDisplayScore != null && Number.isFinite(Number(b.steamDisplayScore))
                      ? formatSteamScore100(b.steamDisplayScore)
                      : b.steamUnscorable ? 'Tarkista' : '-'}
                  </span>
                </div>

                <div className="value-mobile-editors">
                  <div className="value-mobile-editor">
                    <span>Kerroin</span>
                    <ValueOddsEditor
                      bet={b}
                      edit={edit}
                      calc={calc}
                      onChange={value => setBetEdit(b.id, { odds: value })}
                    />
                  </div>
                  <div className="value-mobile-editor">
                    <span>Panos</span>
                    <ValueStakeEditor
                      calc={calc}
                      edit={edit}
                      stakeMode={stakeMode}
                      bankroll={bankroll}
                      error={stakeError}
                      onChange={value => setBetEdit(b.id, {
                        stake: value,
                        stakeOverride: stakeMode === 'kelly',
                      })}
                      onResetKelly={() => resetKellyStake(b.id)}
                    />
                  </div>
                </div>

                <div className="value-mobile-actions">
                  <button
                    type="button"
                    className="ib ghost"
                    onClick={() => skipValueBet(b.id)}
                    disabled={isSkipped}
                    title="Piilota t\u00e4m\u00e4 kohde t\u00e4lt\u00e4 k\u00e4ytt\u00e4j\u00e4tililt\u00e4"
                  >
                    {isSkipped ? 'Ohitettu' : 'Ohita'}
                  </button>
                  <button
                    type="button"
                    className={'ib' + (addDisabled ? '' : ' p')}
                    disabled={addDisabled}
                    onClick={() => addValueBet(b, rowState)}
                    title={stakeError || (stillValue
                      ? 'Lis\u00e4\u00e4 omiin vetoihin muokatulla panoksella ja kertoimella'
                      : 'Muokatulla kertoimella etu ei ole en\u00e4\u00e4 positiivinen')}
                  >
                    {b.added
                      ? 'Lis\u00e4tty'
                      : adding
                        ? 'Lis\u00e4t\u00e4\u00e4n...'
                        : <><Icon name="add" size={11} />Lis&auml;&auml;</>}
                  </button>
                  {actionError && <small className="value-action-error" role="alert">{actionError}</small>}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
