import React, { useState } from 'react';
import { useVedox } from '../context/VedoxContext.jsx';
import { Icon } from '../components/Icon.jsx';
import DatePicker from '../components/DatePicker.jsx';
import LockedView from '../components/LockedView.jsx';
import LoadingView from '../components/LoadingView.jsx';

const EURO = '\u20ac';

function startsInDateRange(startsAt, timeFilter, from, to) {
  if (timeFilter === 'all' || !startsAt) return true;
  const starts = new Date(startsAt).getTime();
  if (!Number.isFinite(starts)) return true;
  const now = Date.now();
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
  return true;
}

export default function Sure() {
  const { arbitrages, stats, refreshEvBets, loading, session, authReady, permissionsReady, setShowAuth, canAccess } = useVedox();
  const [stakes, setStakes] = useState({});
  const [leagueFilter, setLeagueFilter] = useState('Kaikki');
  const [bookFilter, setBookFilter] = useState('Kaikki');
  const [minProfit, setMinProfit] = useState('0');
  const [legsFilter, setLegsFilter] = useState('Kaikki');
  const [timeFilter, setTimeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  if (!authReady || (session && !permissionsReady && arbitrages.length === 0)) {
    return <LoadingView title="Varmavedot" />;
  }

  if (!session || !canAccess('sure')) {
    return <LockedView pageId="sure" session={session} setShowAuth={setShowAuth} />;
  }

  const leagues = ['Kaikki', ...Array.from(new Set(arbitrages.map(a => a.league).filter(Boolean))).sort()];
  const books = ['Kaikki', ...Array.from(new Set(arbitrages.flatMap(a => a.legs.map(l => l.book)).filter(Boolean))).sort()];
  const filteredArbs = arbitrages.filter(a =>
    (leagueFilter === 'Kaikki' || a.league === leagueFilter) &&
    (bookFilter === 'Kaikki' || a.legs.some(l => l.book === bookFilter)) &&
    a.profit >= Number(minProfit || 0) &&
    (legsFilter === 'Kaikki' || a.legs.length === Number(legsFilter)) &&
    startsInDateRange(a.startsAt, timeFilter, dateFrom, dateTo)
  );

  return (
    <div className="page-body">
      <div className="ph">
        <div>
          <h1>Varmavedot</h1>
          <div className="sub">{filteredArbs.length} mahdollista varmavetoa juuri nyt &middot; panos jaetaan eri kirjoille</div>
        </div>
        <div className="actions">
          <button className="btn p refresh-btn" onClick={refreshEvBets} disabled={loading}>
            {loading ? 'P\u00e4ivitet\u00e4\u00e4n...' : 'P\u00e4ivit\u00e4'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue-soft)', color: 'var(--blue)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="sure" size={16} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>Tarkista kertoimet aina bookkerilta ennen pelaamista</div>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>
            Varmavedoissa ratkaisee nopeus. Jos yksikin kerroin laskee, lukittu tuotto ei v&auml;ltt&auml;m&auml;tt&auml; toteudu. P&auml;ivitetty {stats.paivitetty}.
          </div>
        </div>
      </div>

      <div className="filters">
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
          <span>Min. tuotto</span>
          <select value={minProfit} onChange={e => setMinProfit(e.target.value)}>
            <option value="0">0 %</option>
            <option value="1.5">1.5 %</option>
            <option value="2">2 %</option>
            <option value="3">3 %</option>
          </select>
        </label>
        <label className="filter-field narrow">
          <span>Jako</span>
          <select value={legsFilter} onChange={e => setLegsFilter(e.target.value)}>
            <option value="Kaikki">Kaikki</option>
            <option value="2">2 kirjaa</option>
            <option value="3">3 kirjaa</option>
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
        <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{filteredArbs.length} / {arbitrages.length} n&auml;ytet&auml;&auml;n</span>
      </div>

      {filteredArbs.length === 0 && !loading && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text3)' }}>
          Ei varmavetoja t&auml;ll&auml; hetkell&auml;. Vedox tarkistaa jatkuvasti uusia kohteita.
        </div>
      )}

      {filteredArbs.map((s, idx) => {
        const stake = stakes[idx] ?? 200;
        const profitEur = stake * (s.profit / 100);
        const impliedSum = s.legs.reduce((a, l) => a + (l.odds > 0 ? 1 / l.odds : 0), 0);
        const legs = s.legs.map(l => {
          const calculatedShare = impliedSum > 0 && l.odds > 0 ? ((1 / l.odds) / impliedSum) * 100 : 0;
          const share = l.share > 0 ? l.share : calculatedShare;
          return { ...l, share, eur: share > 0 ? Math.round(stake * (share / 100)) : 0 };
        });

        return (
          <div className="card arb-card" key={idx}>
            <div className="left">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3>{s.match}</h3>
                  <div className="lg">{s.league || '-'}</div>
                </div>
                <div className="pill" style={{ background: 'var(--green-soft)', borderColor: 'rgba(48,209,138,.25)', color: 'var(--green)', whiteSpace: 'nowrap' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
                  {s.legs.length} kirjaa
                </div>
              </div>
              <div className="profit">+{s.profit.toFixed(1)}<span className="u">%</span></div>
              <div className="stake-input">
                <span className="l">Kokonaispanos</span>
                <span className="grow" />
                <input value={stake} onChange={e => setStakes(prev => ({ ...prev, [idx]: parseFloat(e.target.value) || 0 }))} type="number" min={1} />
                <span className="u">{EURO}</span>
              </div>
            </div>

            <div className="right">
              <div className="legs">
                <div className="head">
                  <span>Panosjako</span>
                  <span>Tuotto, jos toteutuu <b style={{ color: 'var(--green)', marginLeft: 6 }}>+{profitEur.toFixed(2)} {EURO}</b></span>
                </div>
                {legs.map((l, i) => (
                  <div className="leg" key={i}>
                    <div className="pi">{i + 1}</div>
                    <div className="m">
                      <div className="b">{l.outcome}</div>
                      <div className="s">@ {l.book} &middot; osuus {l.share > 0 ? l.share.toFixed(1) + ' %' : '-'}</div>
                    </div>
                    <div className="o">{l.odds.toFixed(2)}</div>
                    <div className="stake">{l.eur > 0 ? l.eur + ` ${EURO}` : '-'}<div className="s">{l.share > 0 ? l.share.toFixed(1) + '%' : ''}</div></div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 12, color: 'var(--tx3)' }}>
                  <span style={{ flex: 1 }}>Markkina <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{s.market || s.legs[0]?.market || 'h2h'}</span></span>
                  <span>Tuotto/{EURO} <span style={{ color: 'var(--green)', fontWeight: 600 }}>+{profitEur.toFixed(2)} {EURO}</span></span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
