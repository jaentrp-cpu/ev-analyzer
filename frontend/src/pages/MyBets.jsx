import React, { useState } from 'react';
import { useVedox } from '../context/VedoxContext.jsx';
import DatePicker from '../components/DatePicker.jsx';
import LockedView from '../components/LockedView.jsx';
import LoadingView from '../components/LoadingView.jsx';
import PortfolioAnalytics, {
  betInAnalyticsRange,
  normalizeAnalyticsRange,
} from '../components/PortfolioAnalytics.jsx';
import { formatSteamScore100, isTrustedClvTiming } from '../supabase.js';

const EURO = '\u20ac';
const BETTOR_OPTIONS = ['AJ', 'Jalo', 'Leo'];

function formatClvPct(value) {
  if (!Number.isFinite(value)) return null;
  return `${value > 0 ? '+' : ''}${value.toFixed(2)} %`;
}

function clvStatusLabel(bet) {
  const hasClv = Number.isFinite(bet?.clvOdds)
    && bet.clvOdds > 0
    && Number.isFinite(bet?.clvPct);
  if (hasClv) {
    if (bet.clvVerified !== true && bet.clvPhase === 'historical') {
      return 'Historiallinen';
    }
    const trustedTiming = isTrustedClvTiming(
      bet.clvPhase,
      bet.clvCheckedAt,
      bet.clvStartsAt || bet.dateValue || bet.date,
    );
    if (bet.clvVerified === true && trustedTiming && bet.clvPhase === 'closing') {
      return 'Closing vahvistettu';
    }
    if (bet.clvVerified === true && trustedTiming && bet.clvPhase === 'prestart') {
      return 'Pre-start alustava';
    }
    if (bet.clvVerified === true && trustedTiming && bet.clvPhase === 'historical') {
      return 'Historiallinen';
    }
    return 'Vaihe ei varmennettu';
  }
  if (!bet?.sourceBetId) return 'Ei laskettavissa';
  const startsAtMs = new Date(bet?.dateValue || bet?.date || 0).getTime();
  const hasStarted = Number.isFinite(startsAtMs) && startsAtMs <= Date.now() - 2 * 60 * 1000;
  if (bet?.settled || hasStarted) return 'Ei saatavilla';
  return 'Odottaa';
}

function mutationErrorMessage(error, fallback) {
  const message = String(error?.message || '').trim();
  return message || fallback;
}

export default function MyBets() {
  const {
    userBets, bankroll, addManualBet, removeBet, settleBet, editBetDate, editBetTerms,
    bookBalanceMap, booksForBalances, bookBalanceSuggestions, setBookBalance,
    addBookBalanceBook, removeBookBalanceBook,
    session, authReady, permissionsReady, setShowAuth, canAccess,
  } = useVedox();

  const [view, setView] = useState('bets');
  const [tab, setTab] = useState('all');
  const [bookFilter, setBookFilter] = useState('Kaikki');
  const [timeFilter, setTimeFilterState] = useState(() => (
    normalizeAnalyticsRange(localStorage.getItem('vedox_analytics_range') || '30d')
  ));
  const [dateFrom, setDateFromState] = useState(() => localStorage.getItem('vedox_analytics_from') || '');
  const [dateTo, setDateToState] = useState(() => localStorage.getItem('vedox_analytics_to') || '');
  const [showManualForm, setShowManualForm] = useState(false);
  const [manual, setManual] = useState({ date: '', match: '', outcome: '', book: '', odds: '', stake: '', edge: '', market: '' });
  const [manualBettorName, setManualBettorName] = useState(() => {
    const saved = localStorage.getItem('vedox_value_bettor_name') || 'AJ';
    return BETTOR_OPTIONS.includes(saved) ? saved : 'AJ';
  });
  const [bookToAdd, setBookToAdd] = useState('');
  const [editingDate, setEditingDate] = useState(null);
  const [editingTerms, setEditingTerms] = useState(null);
  const [betMutationId, setBetMutationId] = useState(null);
  const [mutationError, setMutationError] = useState(null);

  if (!authReady || (session && !permissionsReady && userBets.length === 0)) {
    return <LoadingView title="Omat vedot" />;
  }

  if (!session || !canAccess('mybets')) {
    return <LockedView pageId="mybets" session={session} setShowAuth={setShowAuth} />;
  }

  const saveTimeFilter = (next) => {
    const normalized = normalizeAnalyticsRange(next);
    setTimeFilterState(normalized);
    localStorage.setItem('vedox_analytics_range', normalized);
    if (normalized !== 'custom') {
      setDateFromState('');
      setDateToState('');
      localStorage.removeItem('vedox_analytics_from');
      localStorage.removeItem('vedox_analytics_to');
    }
  };
  const saveDateFrom = (next) => {
    setDateFromState(next);
    localStorage.setItem('vedox_analytics_from', next);
  };
  const saveDateTo = (next) => {
    setDateToState(next);
    localStorage.setItem('vedox_analytics_to', next);
  };
  const withinTime = bet => betInAnalyticsRange(bet, timeFilter, dateFrom, dateTo);

  const books = ['Kaikki', ...Array.from(new Set(userBets.map(b => b.book).filter(Boolean))).sort()];
  const isWinResult = (b) => b.status === 'won' || b.status === 'half_won';
  const isLossResult = (b) => b.status === 'lost' || b.status === 'half_lost';

  const timeSelectedBets = userBets.filter(withinTime);
  const bookSelectedBets = timeSelectedBets.filter(b => bookFilter === 'Kaikki' || b.book === bookFilter);
  const bets = bookSelectedBets.filter(b => {
    const byTab =
      tab === 'all' ? true :
      tab === 'open' ? b.statusLabel === 'Odottaa' :
      tab === 'won' ? isWinResult(b) :
      isLossResult(b);
    return byTab;
  });

  const rangeWonCount = timeSelectedBets.filter(isWinResult).length;
  const rangeLostCount = timeSelectedBets.filter(isLossResult).length;
  const rangeDecidedCount = rangeWonCount + rangeLostCount;
  const rangeOpenCount = timeSelectedBets.filter(b => b.statusLabel === 'Odottaa').length;
  const rangeSettledBets = timeSelectedBets.filter(b => b.statusLabel !== 'Odottaa');
  const rangeTotalPnl = rangeSettledBets.reduce((sum, b) => sum + (b.pnl || 0), 0);
  const rangeTotalStake = rangeSettledBets.reduce((sum, b) => sum + (Number(b.stake) || 0), 0);
  const rangeRoi = rangeTotalStake > 0 ? (rangeTotalPnl / rangeTotalStake) * 100 : 0;
  const selectedWonCount = bookSelectedBets.filter(isWinResult).length;
  const selectedLostCount = bookSelectedBets.filter(isLossResult).length;
  const selectedOpenCount = bookSelectedBets.filter(b => b.statusLabel === 'Odottaa').length;
  const pnlBars = rangeSettledBets.slice(0, 24).reverse().map(b => b.pnl || 0);
  const maxPnl = Math.max(...pnlBars.map(v => Math.abs(v)), 1);
  const totalBookBalance = booksForBalances.reduce((sum, book) => sum + (Number(bookBalanceMap.get(book)) || 0), 0);

  const setManualField = (field, value) => setManual(prev => ({ ...prev, [field]: value }));

  const startDateEdit = (bet) => {
    setMutationError(null);
    setEditingDate({ id: bet._dbId, value: bet.dateValue || '' });
  };

  const commitDateEdit = async (bet, value = editingDate?.value) => {
    if (!editingDate || editingDate.id !== bet._dbId || betMutationId) return;
    if (!value) {
      setMutationError({ id: bet._dbId, message: 'Valitse vedolle kelvollinen alkamisaika.' });
      return;
    }
    setMutationError(null);
    setBetMutationId(bet._dbId);
    try {
      const result = await editBetDate(bet, value);
      if (result === false) throw new Error('Alkamisajan tallennus hylättiin.');
      setEditingDate(null);
    } catch (error) {
      setMutationError({
        id: bet._dbId,
        message: mutationErrorMessage(error, 'Alkamisajan tallennus epäonnistui. Yritä uudelleen.'),
      });
    } finally {
      setBetMutationId(null);
    }
  };

  const submitManualBet = async (e) => {
    e.preventDefault();
    if (betMutationId) return;
    setMutationError(null);
    setBetMutationId('manual');
    try {
      const result = await addManualBet({ ...manual, bettorName: manualBettorName });
      if (result === false) throw new Error('Vetoa ei voitu lisätä.');
      setManual({ date: '', match: '', outcome: '', book: '', odds: '', stake: '', edge: '', market: '' });
      setShowManualForm(false);
    } catch (error) {
      setMutationError({
        id: 'manual',
        message: mutationErrorMessage(error, 'Vedon lisääminen epäonnistui. Tarkista tiedot ja bookmaker-kassa.'),
      });
    } finally {
      setBetMutationId(null);
    }
  };

  const startTermsEdit = (bet) => {
    setMutationError(null);
    setEditingDate(null);
    setEditingTerms({
      id: bet._dbId,
      odds: Number(bet.odds).toFixed(2),
      stake: Number(bet.stake).toFixed(2),
      ev: Number(bet.ev || 0).toFixed(1),
      saving: false,
      error: '',
    });
  };

  const setTermsField = (field, value) => {
    setMutationError(null);
    setEditingTerms(prev => prev ? { ...prev, [field]: value, error: '' } : prev);
  };

  const commitTermsEdit = async (bet) => {
    if (!editingTerms || editingTerms.id !== bet._dbId || editingTerms.saving || betMutationId) return;
    setMutationError(null);
    setEditingTerms(prev => ({ ...prev, saving: true, error: '' }));
    setBetMutationId(bet._dbId);
    try {
      const result = await editBetTerms(bet, {
        odds: editingTerms.odds,
        stake: editingTerms.stake,
        ev: editingTerms.ev,
      });
      if (result === false) throw new Error('Vedon muutokset hylättiin.');
      setEditingTerms(null);
    } catch (error) {
      const message = mutationErrorMessage(error, 'Tallennus epäonnistui.');
      setEditingTerms(prev => prev && prev.id === bet._dbId
        ? { ...prev, saving: false, error: message }
        : prev);
      setMutationError({ id: bet._dbId, message });
    } finally {
      setBetMutationId(null);
    }
  };

  const commitSettlement = async (bet, result) => {
    if (betMutationId || editingTerms) return;
    setMutationError(null);
    setBetMutationId(bet._dbId);
    try {
      const mutationResult = await settleBet(bet, result);
      if (mutationResult === false) throw new Error('Tuloksen tallennus hylättiin.');
    } catch (error) {
      setMutationError({
        id: bet._dbId,
        message: mutationErrorMessage(error, 'Tuloksen tallennus epäonnistui. Aiempi tulos säilytettiin.'),
      });
    } finally {
      setBetMutationId(null);
    }
  };

  const commitRemoval = async (bet) => {
    if (betMutationId || editingTerms) return;
    setMutationError(null);
    setBetMutationId(bet._dbId);
    try {
      const result = await removeBet(bet);
      if (result === false) throw new Error('Vedon poistaminen hylättiin.');
    } catch (error) {
      setMutationError({
        id: bet._dbId,
        message: mutationErrorMessage(error, 'Vedon poistaminen epäonnistui. Päivitä sivu ennen uutta yritystä.'),
      });
    } finally {
      setBetMutationId(null);
    }
  };

  const submitBookAdd = async (e) => {
    e.preventDefault();
    const clean = bookToAdd.trim();
    if (!clean) return;
    await addBookBalanceBook(clean);
    setBookToAdd('');
  };

  return (
    <div className="page-body">
      <div className="ph">
        <div>
          <h1>{view === 'analytics' ? 'Analytiikka' : view === 'balances' ? 'Kassat' : 'Omat vedot'}</h1>
          <div className="sub">Tulokset, CLV, ROI ja muokattava vetohistoria &middot; {timeSelectedBets.length}/{userBets.length} vetoa valitulla aikav&auml;lill&auml;</div>
        </div>
        <div className="actions">
          <div className="seg">
            <button disabled={Boolean(editingTerms || betMutationId)} onClick={() => setView(view === 'bets' ? 'analytics' : 'bets')}>
              {view === 'bets' ? 'Analytiikka' : 'Omat vedot'}
            </button>
            <button disabled={Boolean(editingTerms || betMutationId)} className={view === 'balances' ? 'on' : ''} onClick={() => setView('balances')}>Kassat</button>
          </div>
          {view === 'bets' && (
            <button className="btn p" disabled={Boolean(editingTerms || betMutationId)} onClick={() => setShowManualForm(v => !v)}>
              {showManualForm ? 'Sulje' : 'Lis\u00e4\u00e4 veto'}
            </button>
          )}
        </div>
      </div>

      {mutationError && (
        <div className="bet-mutation-banner" role="alert">
          <span>{mutationError.message}</span>
          <button type="button" onClick={() => setMutationError(null)} aria-label="Sulje virheilmoitus">Sulje</button>
        </div>
      )}

      {view === 'analytics' && !canAccess('analytics') && (
        <div className="stat-grid my-stats">
          <div className="s"><div className="l">Vetoja aikav&auml;lill&auml;</div><div className="v">{timeSelectedBets.length}</div><div className="d">{rangeOpenCount} avoinna &middot; {userBets.length} kaikkiaan</div></div>
          <div className="s"><div className="l">Voitettu</div><div className="v g">{rangeWonCount}</div><div className="d">{rangeDecidedCount > 0 ? ((rangeWonCount / rangeDecidedCount) * 100).toFixed(1) : '0'} % osuma</div></div>
          <div className="s"><div className="l">H&auml;vitty</div><div className="v r">{rangeLostCount}</div><div className="d">{rangeDecidedCount} W/L-ratkaisusta</div></div>
          <div className="s"><div className="l">Tuotto (PnL)</div><div className={'v ' + (rangeTotalPnl >= 0 ? 'g' : 'r')}>{rangeTotalPnl >= 0 ? '+' : ''}{rangeTotalPnl.toFixed(2)} {EURO}</div><div className="d">ROI {rangeRoi >= 0 ? '+' : ''}{rangeRoi.toFixed(1)} %</div></div>
        </div>
      )}

      {view === 'bets' && showManualForm && (
        <form className="card" style={{ padding: '14px 18px' }} onSubmit={submitManualBet}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 14.5, fontWeight: 600 }}>Lis&auml;&auml; veto k&auml;sin</h3>
              <div style={{ color: 'var(--tx3)', fontSize: 12 }}>Manuaalinen veto v&auml;hent&auml;&auml; valitun kirjan saldoa panoksen verran.</div>
            </div>
            <button className="btn p" type="submit" disabled={Boolean(editingTerms || betMutationId)}>Lis&auml;&auml;</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 8 }}>
            <label className="filter-field" style={{ margin: 0 }}>
              <span>Lis&auml;&auml;j&auml;</span>
              <select value={manualBettorName} onChange={e => {
                setManualBettorName(e.target.value);
                localStorage.setItem('vedox_value_bettor_name', e.target.value);
              }}>
                {BETTOR_OPTIONS.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="filter-field" style={{ margin: 0 }}>
              <span>Pvm</span>
              <DatePicker mode="datetime" value={manual.date} onChange={value => setManualField('date', value)} placeholder="Valitse aika" />
            </label>
            <label className="filter-field" style={{ margin: 0 }}>
              <span>Ottelu</span>
              <input value={manual.match} onChange={e => setManualField('match', e.target.value)} placeholder="Joukkue A vs Joukkue B" required />
            </label>
            <label className="filter-field" style={{ margin: 0 }}>
              <span>Kohde</span>
              <input value={manual.outcome} onChange={e => setManualField('outcome', e.target.value)} placeholder="Kotivoitto" required />
            </label>
            <label className="filter-field" style={{ margin: 0 }}>
              <span>Kirja</span>
              <select value={manual.book} onChange={e => setManualField('book', e.target.value)} required>
                <option value="">Valitse</option>
                {booksForBalances.map(book => <option key={book} value={book}>{book}</option>)}
              </select>
            </label>
            <label className="filter-field" style={{ margin: 0 }}>
              <span>Kerroin</span>
              <input type="number" min="1.01" step="0.01" value={manual.odds} onChange={e => setManualField('odds', e.target.value)} placeholder="2.00" required />
            </label>
            <label className="filter-field" style={{ margin: 0 }}>
              <span>Panos</span>
              <input type="number" min="0.01" step="0.01" value={manual.stake} onChange={e => setManualField('stake', e.target.value)} placeholder="2.25" required />
            </label>
            <label className="filter-field" style={{ margin: 0 }}>
              <span>Etu %</span>
              <input type="number" step="0.1" value={manual.edge} onChange={e => setManualField('edge', e.target.value)} placeholder="0" />
            </label>
            <label className="filter-field" style={{ margin: 0 }}>
              <span>Markkina</span>
              <input value={manual.market} onChange={e => setManualField('market', e.target.value)} placeholder="h2h" />
            </label>
          </div>
        </form>
      )}

      {view === 'balances' && (
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <form onSubmit={submitBookAdd} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 260px) auto', gap: 8, alignItems: 'end' }}>
              <label className="filter-field" style={{ margin: 0 }}>
                <span>Lis&auml;&auml; kirja</span>
                <input list="book-balance-suggestions" value={bookToAdd} onChange={e => setBookToAdd(e.target.value)} placeholder="Valitse tai kirjoita" />
                <datalist id="book-balance-suggestions">
                  {(bookBalanceSuggestions || []).map(book => <option key={book} value={book} />)}
                </datalist>
              </label>
              <button className="btn p" type="submit" style={{ height: 38 }}>Lis&auml;&auml;</button>
            </form>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ color: 'var(--tx3)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Yhteens&auml;</div>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 16, fontWeight: 650 }}>{totalBookBalance.toFixed(2)} {EURO}</div>
            </div>
          </div>
          {booksForBalances.length === 0 ? (
            <div style={{ color: 'var(--tx3)', fontSize: 13 }}>Lis&auml;&auml; ensimm&auml;inen kirja yll&auml; olevasta kent&auml;st&auml;.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(122px, 1fr))', gap: 8 }}>
              {booksForBalances.map(book => {
                const value = bookBalanceMap.get(book) ?? '';
                return (
                  <label key={book} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 66px', alignItems: 'center', gap: 6, height: 32, padding: '4px 7px', border: '1px solid var(--bd)', borderRadius: 7, background: 'var(--bg3)', minWidth: 0, position: 'relative' }}>
                    <span title={book} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx3)', fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>{book}</span>
                    <input type="number" min="0" step="0.01" value={value} onChange={e => setBookBalance(book, e.target.value)} placeholder="0.00" style={{ width: 66, minWidth: 0, height: 24, padding: '3px 5px', border: 0, outline: 'none', borderRadius: 5, background: 'var(--bg)', color: 'var(--tx)', fontFamily: 'Geist Mono, monospace', fontSize: 12 }} />
                    <button type="button" title="Poista kassa" onClick={() => removeBookBalanceBook(book)} style={{ position: 'absolute', right: -6, top: -6, width: 18, height: 18, borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx3)', fontSize: 12, lineHeight: '16px', cursor: 'pointer' }}>x</button>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === 'analytics' && (
        <>
          <PortfolioAnalytics
            userBets={userBets}
            bankroll={bankroll}
            canViewAdvanced={canAccess('analytics')}
            range={timeFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onRangeChange={saveTimeFilter}
            onDateFromChange={saveDateFrom}
            onDateToChange={saveDateTo}
          />
        </>
      )}

      {view === 'bets' && (
        <>
          <div className="card my-filter-card">
            <div className="mini-profit">
              <div className="mini-profit-label">Tuottok&auml;yr&auml; &middot; {pnlBars.length} viim. vetoa</div>
              <div className="mini-bars">
                {pnlBars.map((v, i) => (
                  <span key={i} className={v >= 0 ? 'up' : 'down'} style={{ height: `${Math.max(4, (Math.abs(v) / maxPnl) * 28)}px` }} />
                ))}
              </div>
            </div>
            <div className="filters compact">
              <label className="filter-field narrow">
                <span>Aika</span>
                <select value={timeFilter} onChange={e => saveTimeFilter(e.target.value)}>
                  <option value="all">Kaikki</option>
                  <option value="today">T&auml;n&auml;&auml;n</option>
                  <option value="tomorrow">Huomenna</option>
                  <option value="yesterday">Eilen</option>
                  <option value="day_before_yesterday">Toissap&auml;iv&auml;n&auml;</option>
                  <option value="7d">7 pv</option>
                  <option value="30d">30 pv</option>
                  <option value="90d">90 pv</option>
                  <option value="custom">P&auml;iv&auml;m&auml;&auml;r&auml;</option>
                </select>
              </label>
              {timeFilter === 'custom' && (
                <>
                  <label className="filter-field date">
                    <span>Alkaen</span>
                    <DatePicker value={dateFrom} onChange={saveDateFrom} />
                  </label>
                  <label className="filter-field date">
                    <span>Asti</span>
                    <DatePicker value={dateTo} onChange={saveDateTo} />
                  </label>
                </>
              )}
              <label className="filter-field">
                <span>Bookkeri</span>
                <select value={bookFilter} onChange={e => setBookFilter(e.target.value)}>
                  {books.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
            </div>
            <div className="seg">
              <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>Kaikki ({bookSelectedBets.length})</button>
              <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>Kesken ({selectedOpenCount})</button>
              <button className={tab === 'won' ? 'on' : ''} onClick={() => setTab('won')}>Voitot ({selectedWonCount})</button>
              <button className={tab === 'lost' ? 'on' : ''} onClick={() => setTab('lost')}>Tappiot ({selectedLostCount})</button>
            </div>
          </div>

          <div className="card my-table">
            <div className="card-head">
              <h3>Vetohistoria</h3>
              <div className="info"><span>{bets.length} n&auml;ytet&auml;&auml;n &middot; {timeSelectedBets.length}/{userBets.length} aikav&auml;lill&auml;</span></div>
            </div>
            <div className="history-desktop" style={{ overflow: 'auto' }}>
              {bets.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Ei vetoja</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 96 }}>Aika</th>
                      <th style={{ width: 76 }}>Lis&auml;&auml;j&auml;</th>
                      <th>Ottelu</th>
                      <th>Kohde</th>
                      <th style={{ width: 90 }}>Kirja</th>
                      <th className="r" style={{ width: 70 }}>Kerroin</th>
                      <th className="r" style={{ width: 80 }}>Panos</th>
                      <th className="r" style={{ width: 70 }}>Etu</th>
                      <th className="r" style={{ width: 96 }}>Steam</th>
                      <th className="r" style={{ width: 82 }}>CLV</th>
                      <th style={{ width: 90 }}>Tulos</th>
                      <th className="r" style={{ width: 90 }}>PnL</th>
                      <th className="r" style={{ width: 238 }}>Toiminnot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bets.map((b, i) => {
                      const isEditingTerms = editingTerms?.id === b._dbId;
                      return (
                      <tr key={b._dbId || i}>
                        <td>
                          {editingDate?.id === b._dbId ? (
                            <div className="date-edit-inline">
                              <DatePicker
                                mode="datetime"
                                value={editingDate.value}
                                onChange={value => setEditingDate(prev => ({ ...prev, value }))}
                                placeholder="Valitse aika"
                              />
                              <button type="button" onClick={() => commitDateEdit(b)}>OK</button>
                              <button type="button" onClick={() => setEditingDate(null)}>x</button>
                            </div>
                          ) : (
                            <button className="bet-date-button" type="button" disabled={Boolean(editingTerms || betMutationId)} onClick={() => startDateEdit(b)} title="Muokkaa alkamisaikaa">
                              {b.date || '-'}
                            </button>
                          )}
                        </td>
                        <td><span style={{ fontSize: 12.5, color: 'var(--tx2)', fontWeight: 600 }}>{b.bettorName || '-'}</span></td>
                        <td><span style={{ fontWeight: 500 }}>{b.match}</span></td>
                        <td><span style={{ color: 'var(--blue)', fontSize: 12.5, fontWeight: 500 }}>{b.pick}</span></td>
                        <td><span style={{ fontSize: 12.5, color: 'var(--tx2)' }}>{b.book}</span></td>
                        <td className="r" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {isEditingTerms
                            ? <input className="bet-term-input" type="number" min="1.01" step="0.01" disabled={editingTerms.saving} value={editingTerms.odds} onChange={e => setTermsField('odds', e.target.value)} aria-label="Muokkaa kerrointa" />
                            : b.odds.toFixed(2)}
                        </td>
                        <td className="r" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {isEditingTerms
                            ? <input className="bet-term-input" type="number" min="0.01" step="0.01" disabled={editingTerms.saving} value={editingTerms.stake} onChange={e => setTermsField('stake', e.target.value)} aria-label="Muokkaa panosta" />
                            : `${Number(b.stake).toFixed(2)} ${EURO}`}
                        </td>
                        <td className="r" style={{ fontFamily: 'monospace', color: 'var(--blue)', fontSize: 12 }}>
                          {isEditingTerms
                            ? <input className="bet-term-input" type="number" step="0.1" disabled={editingTerms.saving} value={editingTerms.ev} onChange={e => setTermsField('ev', e.target.value)} aria-label="Muokkaa etua" />
                            : `${Number(b.ev || 0) >= 0 ? '+' : ''}${Number(b.ev || 0).toFixed(1)} %`}
                        </td>
                        <td className="r">
                          {b.steamDisplayScore != null && Number.isFinite(Number(b.steamDisplayScore)) ? (
                            <span
                              className="steam-rating-value"
                              title={[
                                b.steamDisplaySource === 'steam_rating_rules'
                                  ? 'opittu Steam-rating'
                                  : `reaaliaikainen ${Number(b.legacySteamScore).toFixed(1)}/58 skaalattuna`,
                                b.steamDisplayLabel,
                                b.steamLabels != null && Number.isFinite(Number(b.steamLabels)) ? `${b.steamLabels} opetuslabelia` : '',
                                b.steamAvgClv != null && Number.isFinite(Number(b.steamAvgClv)) ? `säännön AVG CLV ${Number(b.steamAvgClv).toFixed(2)} %` : '',
                              ].filter(Boolean).join(' · ')}
                            >
                              <strong>{formatSteamScore100(b.steamDisplayScore)}</strong>
                              <small>{b.steamDisplayLabel}</small>
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
                        <td className={'r clv-cell ' + (b.clvPct > 0 ? 'g' : b.clvPct < 0 ? 'bad' : 'n')}>
                          {Number.isFinite(b.clvPct) ? (
                            <>
                              <span>{formatClvPct(b.clvPct)}</span>
                              {Number.isFinite(b.clvOdds) && <small>Viite {b.clvOdds.toFixed(3)}</small>}
                              <small>{clvStatusLabel(b)}</small>
                            </>
                          ) : (
                            <span className="muted">{clvStatusLabel(b)}</span>
                          )}
                        </td>
                        <td><span className={'status ' + (isWinResult(b) ? 'v' : isLossResult(b) ? 't' : 'o')}>{b.statusLabel}</span></td>
                        <td className={'pnl ' + (b.pnl > 0 ? 'g' : b.pnl < 0 ? 'bad' : 'n')} style={{ textAlign: 'right' }}>
                          {b.statusLabel === 'Odottaa' ? '\u2014' : (b.pnl > 0 ? '+' : '') + b.pnl.toFixed(2) + ` ${EURO}`}
                        </td>
                        <td className="r">
                          <div className="bet-actions">
                            <select className="result-select" value={b.status} disabled={Boolean(editingTerms || betMutationId)} onChange={e => commitSettlement(b, e.target.value)} aria-label="Valitse vedon tulos">
                              <option value="pending">Odottaa</option>
                              <option value="won">Voitto</option>
                              <option value="lost">Tappio</option>
                              <option value="push">Palautus</option>
                              <option value="half_won">Half win</option>
                              <option value="half_lost">Half loss</option>
                            </select>
                            {isEditingTerms ? (
                              <>
                                <button type="button" className="save-bet-edit" disabled={editingTerms.saving} onClick={() => commitTermsEdit(b)}>
                                  {editingTerms.saving ? 'Tallennetaan…' : 'Tallenna'}
                                </button>
                                <button type="button" className="cancel-bet-edit" disabled={editingTerms.saving} onClick={() => setEditingTerms(null)}>Peruuta</button>
                              </>
                            ) : (
                              <button type="button" className="edit-bet" disabled={Boolean(editingTerms || betMutationId)} onClick={() => startTermsEdit(b)}>Muokkaa</button>
                            )}
                            <button className="delete-bet" disabled={Boolean(editingTerms || betMutationId)} title="Poista veto" onClick={() => commitRemoval(b)}>Poista</button>
                            {isEditingTerms && editingTerms.error && <small className="bet-edit-error">{editingTerms.error}</small>}
                            {mutationError?.id === b._dbId && mutationError.message !== editingTerms?.error && (
                              <small className="bet-edit-error" role="alert">{mutationError.message}</small>
                            )}
                          </div>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              )}
            </div>
            {bets.length > 0 && (
              <div className="my-cards history-cards">
                {bets.map((b, i) => {
                  const isEditingTerms = editingTerms?.id === b._dbId;
                  return (
                    <article className="mc" key={`mobile-${b._dbId || i}`}>
                      <div>
                        <div className="t">{b.match}</div>
                        <div className="s">
                          {editingDate?.id === b._dbId ? (
                            <div className="date-edit-inline">
                              <DatePicker
                                mode="datetime"
                                value={editingDate.value}
                                onChange={value => setEditingDate(prev => ({ ...prev, value }))}
                                placeholder="Valitse aika"
                              />
                              <button type="button" onClick={() => commitDateEdit(b)}>OK</button>
                              <button type="button" onClick={() => setEditingDate(null)}>x</button>
                            </div>
                          ) : (
                            <button className="bet-date-button" type="button" disabled={Boolean(editingTerms || betMutationId)} onClick={() => startDateEdit(b)}>
                              {b.date || '-'}
                            </button>
                          )}
                          <span className="d" />
                          <span>{b.bettorName || '-'}</span>
                          <span className="d" />
                          <span className="pk">{b.pick}</span>
                          <span className="d" />
                          <span>{b.book}</span>
                        </div>
                      </div>
                      <span className={'status ' + (isWinResult(b) ? 'v' : isLossResult(b) ? 't' : 'o')}>{b.statusLabel}</span>

                      <div className="row">
                        <div className="b">
                          <div className="l">Kerroin</div>
                          <div className="v">
                            {isEditingTerms
                              ? <input className="bet-term-input" type="number" min="1.01" step="0.01" disabled={editingTerms.saving} value={editingTerms.odds} onChange={e => setTermsField('odds', e.target.value)} aria-label="Muokkaa kerrointa" />
                              : b.odds.toFixed(2)}
                          </div>
                        </div>
                        <div className="b">
                          <div className="l">Panos</div>
                          <div className="v">
                            {isEditingTerms
                              ? <input className="bet-term-input" type="number" min="0.01" step="0.01" disabled={editingTerms.saving} value={editingTerms.stake} onChange={e => setTermsField('stake', e.target.value)} aria-label="Muokkaa panosta" />
                              : `${Number(b.stake).toFixed(2)} ${EURO}`}
                          </div>
                        </div>
                        <div className="b">
                          <div className="l">Etu</div>
                          <div className="v">
                            {isEditingTerms
                              ? <input className="bet-term-input" type="number" step="0.1" disabled={editingTerms.saving} value={editingTerms.ev} onChange={e => setTermsField('ev', e.target.value)} aria-label="Muokkaa etua" />
                              : `${Number(b.ev || 0) >= 0 ? '+' : ''}${Number(b.ev || 0).toFixed(1)} %`}
                          </div>
                        </div>
                        <div className="b">
                          <div className="l">CLV</div>
                          <div className={'v ' + (b.clvPct > 0 ? 'g' : b.clvPct < 0 ? 'bad' : 'n')}>
                            {formatClvPct(b.clvPct) || clvStatusLabel(b)}
                            {Number.isFinite(b.clvOdds) && <small>Viite {b.clvOdds.toFixed(3)}</small>}
                            {Number.isFinite(b.clvPct) && <small>{clvStatusLabel(b)}</small>}
                          </div>
                        </div>
                        <div className="b">
                          <div className="l">Steam</div>
                          <div className="v steam-mobile-value">
                            {b.steamDisplayScore != null && Number.isFinite(Number(b.steamDisplayScore))
                              ? formatSteamScore100(b.steamDisplayScore)
                              : b.steamUnscorable ? 'Tarkista' : '-'}
                            {b.steamDisplayLabel && <small>{b.steamDisplayLabel}</small>}
                          </div>
                        </div>
                        <div className="b">
                          <div className="l">PnL</div>
                          <div className={'v ' + (b.pnl > 0 ? 'g' : b.pnl < 0 ? 'bad' : 'n')}>
                            {b.statusLabel === 'Odottaa' ? '\u2014' : `${b.pnl > 0 ? '+' : ''}${b.pnl.toFixed(2)} ${EURO}`}
                          </div>
                        </div>
                      </div>

                      <div className="mobile-bet-actions">
                        <select className="result-select" value={b.status} disabled={Boolean(editingTerms || betMutationId)} onChange={e => commitSettlement(b, e.target.value)} aria-label="Valitse vedon tulos">
                          <option value="pending">Odottaa</option>
                          <option value="won">Voitto</option>
                          <option value="lost">Tappio</option>
                          <option value="push">Palautus</option>
                          <option value="half_won">Half win</option>
                          <option value="half_lost">Half loss</option>
                        </select>
                        {isEditingTerms ? (
                          <>
                            <button type="button" className="save-bet-edit" disabled={editingTerms.saving} onClick={() => commitTermsEdit(b)}>
                              {editingTerms.saving ? 'Tallennetaan…' : 'Tallenna'}
                            </button>
                            <button type="button" className="cancel-bet-edit" disabled={editingTerms.saving} onClick={() => setEditingTerms(null)}>Peruuta</button>
                          </>
                        ) : (
                          <button type="button" className="edit-bet" disabled={Boolean(editingTerms || betMutationId)} onClick={() => startTermsEdit(b)}>Muokkaa</button>
                        )}
                        <button className="delete-bet" disabled={Boolean(editingTerms || betMutationId)} onClick={() => commitRemoval(b)}>Poista</button>
                        {isEditingTerms && editingTerms.error && <small className="bet-edit-error">{editingTerms.error}</small>}
                        {mutationError?.id === b._dbId && mutationError.message !== editingTerms?.error && (
                          <small className="bet-edit-error" role="alert">{mutationError.message}</small>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {bets.length === 0 && <div className="history-cards history-mobile-empty">Ei vetoja</div>}
          </div>
        </>
      )}
    </div>
  );
}
