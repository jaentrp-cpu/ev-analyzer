import React, { useState } from 'react';
import { useVedox } from '../context/VedoxContext.jsx';
import DatePicker from '../components/DatePicker.jsx';
import LockedView from '../components/LockedView.jsx';
import LoadingView from '../components/LoadingView.jsx';
import { deriveBetTaxonomy } from '../supabase.js';

const EURO = '\u20ac';
const ANALYTICS_RANGES = new Set(['all', 'today', 'yesterday', 'day_before_yesterday', '7d', '30d', '90d', 'custom']);

function normalizeAnalyticsRange(value) {
  return ANALYTICS_RANGES.has(value) ? value : '30d';
}

function BarChart({ pnl, h = 140 }) {
  if (!pnl.length) {
    return <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>Ei ratkaistuja vetoja vielä</div>;
  }
  const max = Math.max(...pnl.map(Math.abs), 1);
  const w = 560;
  const bw = w / pnl.length;
  const zero = h * 0.55;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <line x1="0" y1={zero} x2={w} y2={zero} stroke="var(--bd)" strokeWidth="1" />
      {pnl.map((v, i) => {
        const ratio = Math.abs(v) / max;
        const bh = ratio * (v >= 0 ? zero - 10 : h - zero - 10);
        const x = i * bw + bw * 0.18;
        return v >= 0
          ? <rect key={i} x={x} y={zero - bh} width={bw * 0.64} height={bh} fill="var(--green)" rx="2" />
          : <rect key={i} x={x} y={zero} width={bw * 0.64} height={bh} fill="var(--red)" rx="2" />;
      })}
    </svg>
  );
}

function parseBetTime(bet) {
  if (bet.dateValue) {
    const parsed = new Date(bet.dateValue).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  const raw = String(bet.date || '');
  const fi = raw.match(/^(\d{1,2})\.(\d{1,2})\.\s*(?:(\d{1,2})[.:](\d{2}))?/);
  if (fi) {
    const year = new Date().getFullYear();
    const parsed = new Date(year, Number(fi[2]) - 1, Number(fi[1]), Number(fi[3] || 0), Number(fi[4] || 0)).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  const created = new Date(bet.createdAt).getTime();
  return Number.isFinite(created) ? created : null;
}

function dayBounds(offsetDays) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return [start.getTime(), end.getTime()];
}

function inRange(bet, range, from, to) {
  const normalizedRange = normalizeAnalyticsRange(range);
  if (normalizedRange === 'all') return true;
  const t = parseBetTime(bet);
  if (!Number.isFinite(t)) return true;
  const now = Date.now();
  if (normalizedRange === 'today') {
    const [start, end] = dayBounds(0);
    return t >= start && t <= end;
  }
  if (normalizedRange === 'yesterday') {
    const [start, end] = dayBounds(-1);
    return t >= start && t <= end;
  }
  if (normalizedRange === 'day_before_yesterday') {
    const [start, end] = dayBounds(-2);
    return t >= start && t <= end;
  }
  if (normalizedRange === '7d') return t >= now - 7 * 864e5;
  if (normalizedRange === '30d') return t >= now - 30 * 864e5;
  if (normalizedRange === '90d') return t >= now - 90 * 864e5;
  if (normalizedRange === 'custom') {
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : null;
    const fromOk = from && Number.isFinite(fromTime) ? t >= fromTime : true;
    const toOk = to && Number.isFinite(toTime) ? t <= toTime : true;
    return fromOk && toOk;
  }
  return true;
}

function formatPct(value, digits = 1) {
  if (!Number.isFinite(value)) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function displayTaxonomy(bet) {
  return deriveBetTaxonomy(bet);
}

function displayMarket(bet) {
  return displayTaxonomy(bet).market;
}

function hasValidClv(bet) {
  const clvPct = Number(bet?.clvPct);
  const clvOdds = Number(bet?.clvOdds);
  return Number.isFinite(clvPct) && Number.isFinite(clvOdds) && clvOdds > 0;
}

function MetricBars({ rows, emptyLabel = 'Ei dataa' }) {
  const shown = rows.length ? rows.slice(0, 10) : [{ label: emptyLabel, ev: 0, n: 0 }];
  return (
    <div className="roi-bars metric-bars">
      {shown.map((r, i) => {
        const width = Math.min(100, Math.max(6, Math.abs(r.ev) * 5));
        return (
          <div className="it" key={`${r.label}-${i}`}>
            <span title={r.label}>{r.label}</span>
            <div className="b">
              <span className={'fill' + (r.ev < 0 ? ' r' : '')} style={{ width: `${width}%` }} />
            </div>
            <span className={'v ' + (r.ev >= 0 ? 'g' : 'r')}>{r.ev >= 0 ? '+' : ''}{r.ev.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function SplitBars({ rows, emptyLabel = 'Ei dataa' }) {
  const shown = rows.length ? rows.slice(0, 12) : [{ label: emptyLabel, pct: 100, n: 0 }];
  return (
    <div className="split-bars">
      {shown.map((r, i) => (
        <div className="split-row" key={`${r.label}-${i}`}>
          <div className="split-label"><span title={r.label}>{r.label}</span><b>{r.pct}%</b></div>
          <div className="split-track"><span style={{ width: `${Math.max(3, r.pct)}%` }} /></div>
          <div className="split-count">{r.n} vetoa</div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { userBets, bankroll, session, authReady, permissionsReady, setShowAuth, canAccess } = useVedox();
  const [range, setRange] = useState(() => normalizeAnalyticsRange(localStorage.getItem('vedox_analytics_range') || '30d'));
  const [dateFrom, setDateFrom] = useState(() => localStorage.getItem('vedox_analytics_from') || '');
  const [dateTo, setDateTo] = useState(() => localStorage.getItem('vedox_analytics_to') || '');

  if (!authReady || (session && !permissionsReady && userBets.length === 0)) {
    return <LoadingView title="Analytiikka" />;
  }

  if (!session || !canAccess('analytics')) {
    return <LockedView pageId="analytics" session={session} setShowAuth={setShowAuth} />;
  }

  const clearCustomDates = () => {
    setDateFrom('');
    setDateTo('');
    localStorage.removeItem('vedox_analytics_from');
    localStorage.removeItem('vedox_analytics_to');
  };
  const saveRange = (next) => {
    const normalizedRange = normalizeAnalyticsRange(next);
    setRange(normalizedRange);
    localStorage.setItem('vedox_analytics_range', normalizedRange);
    if (normalizedRange !== 'custom') clearCustomDates();
  };
  const saveFrom = (next) => { setDateFrom(next); localStorage.setItem('vedox_analytics_from', next); };
  const saveTo = (next) => { setDateTo(next); localStorage.setItem('vedox_analytics_to', next); };
  const resetRange = () => saveRange('30d');

  const rangeBets = userBets.filter(b => inRange(b, range, dateFrom, dateTo));
  const settled = rangeBets.filter(b => b.statusLabel !== 'Odottaa');
  const won = settled.filter(b => b.status === 'won' || b.status === 'half_won');
  const totalPnl = settled.reduce((sum, b) => sum + (b.pnl || 0), 0);
  const totalStake = settled.reduce((sum, b) => sum + (Number(b.stake) || 0), 0);
  const roi = totalStake > 0 ? (totalPnl / totalStake) * 100 : 0;
  const hitRate = settled.length ? (won.length / settled.length) * 100 : 0;
  const currentBankroll = bankroll;
  const pnlArray = settled.slice(-60).map(b => b.pnl || 0);
  const bankrollArray = (() => {
    const start = currentBankroll - totalPnl;
    const points = [start];
    pnlArray.forEach(v => points.push(points[points.length - 1] + v));
    return points;
  })();

  const sportCounts = {};
  const sportAgg = {};
  const leagueCounts = {};
  const leagueAgg = {};
  rangeBets.forEach(b => {
    const { sport, league } = displayTaxonomy(b);
    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    leagueCounts[league] = (leagueCounts[league] || 0) + 1;
    if (b.statusLabel !== 'Odottaa') {
      if (!sportAgg[sport]) sportAgg[sport] = { sport, pnl: 0, stake: 0, n: 0 };
      sportAgg[sport].pnl += b.pnl || 0;
      sportAgg[sport].stake += Number(b.stake) || 0;
      sportAgg[sport].n += 1;
      if (!leagueAgg[league]) leagueAgg[league] = { league, pnl: 0, stake: 0, n: 0 };
      leagueAgg[league].pnl += b.pnl || 0;
      leagueAgg[league].stake += Number(b.stake) || 0;
      leagueAgg[league].n += 1;
    }
  });
  const rangeTotal = rangeBets.length || 1;
  const sportSplit = Object.entries(sportCounts)
    .map(([sport, n]) => ({ label: sport, sport, pct: Math.round(n / rangeTotal * 100), n }))
    .sort((a, b) => b.n - a.n);
  const roiBySport = Object.values(sportAgg)
    .map(s => ({ ...s, label: s.sport, ev: s.stake > 0 ? (s.pnl / s.stake) * 100 : 0 }))
    .sort((a, b) => b.ev - a.ev);
  const leagueSplit = Object.entries(leagueCounts)
    .map(([league, n]) => ({ label: league, league, pct: Math.round(n / rangeTotal * 100), n }))
    .sort((a, b) => b.n - a.n);
  const roiByLeague = Object.values(leagueAgg)
    .map(s => ({ ...s, label: s.league, ev: s.stake > 0 ? (s.pnl / s.stake) * 100 : 0 }))
    .sort((a, b) => b.ev - a.ev);
  const rangeLabel = range === 'all' ? 'kaikki vedot'
    : range === 'today' ? 'tänään'
    : range === 'yesterday' ? 'eilen'
    : range === 'day_before_yesterday' ? 'toissapäivänä'
    : range === '7d' ? 'viimeiset 7 päivää'
    : range === '30d' ? 'viimeiset 30 päivää'
    : range === '90d' ? 'viimeiset 90 päivää'
    : 'valittu aikaväli';
  const clvBets = rangeBets.filter(hasValidClv);
  const avgClv = clvBets.length ? clvBets.reduce((sum, b) => sum + Number(b.clvPct), 0) / clvBets.length : null;
  const positiveClv = clvBets.filter(b => Number(b.clvPct) > 0).length;
  const positiveClvPct = clvBets.length ? (positiveClv / clvBets.length) * 100 : null;
  const bestClv = clvBets.length ? Math.max(...clvBets.map(b => Number(b.clvPct))) : null;
  const worstClv = clvBets.length ? Math.min(...clvBets.map(b => Number(b.clvPct))) : null;
  const clvSegments = (() => {
    const map = new Map();
    clvBets.forEach(b => {
    const { sport, league } = displayTaxonomy(b);
      const market = displayMarket(b);
      const key = `${sport}||${league}||${market}`;
      const prev = map.get(key) || { key, sport, league, market, n: 0, sum: 0, pos: 0 };
      prev.n += 1;
      prev.sum += Number(b.clvPct);
      if (Number(b.clvPct) > 0) prev.pos += 1;
      map.set(key, prev);
    });
    return Array.from(map.values())
      .map(s => ({ ...s, avg: s.sum / s.n, hit: (s.pos / s.n) * 100 }))
      .sort((a, b) => Math.abs(b.avg) - Math.abs(a.avg))
      .slice(0, 8);
  })();
  const rangeControls = (
    <div className="filters compact analytics-range">
      <label className="filter-field narrow">
        <span>Aika</span>
        <select value={range} onChange={e => saveRange(e.target.value)}>
          <option value="today">Tänään</option>
          <option value="yesterday">Eilen</option>
          <option value="day_before_yesterday">Toissapäivänä</option>
          <option value="7d">7 pv</option>
          <option value="30d">30 pv</option>
          <option value="90d">90 pv</option>
          <option value="all">Kaikki</option>
          <option value="custom">Päivämäärä</option>
        </select>
      </label>
      {range === 'custom' && (
        <>
          <label className="filter-field date"><span>Alkaen</span><DatePicker value={dateFrom} onChange={saveFrom} /></label>
          <label className="filter-field date"><span>Asti</span><DatePicker value={dateTo} onChange={saveTo} /></label>
          <button type="button" className="chip action" onClick={resetRange}>Resetoi</button>
        </>
      )}
    </div>
  );

  if (settled.length === 0) {
    return (
      <div className="page-body">
        <div className="ph">
          <div><h1>Analytiikka</h1><div className="sub">Tuotto, kehitys ja vetojakauma &middot; {rangeLabel}</div></div>
          {rangeControls}
        </div>
        <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 15, marginBottom: 8 }}>Ei ratkaistuja vetoja vielä</div>
          <div style={{ fontSize: 13 }}>Analytiikka päivittyy, kun valitulla aikavälillä on ratkaistuja vetoja.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-body">
      <div className="ph">
        <div><h1>Analytiikka</h1><div className="sub">Kassan kehitys, tuotto lajeittain ja vetojakauma &middot; {rangeLabel}</div></div>
        {rangeControls}
      </div>

      <div className="stat-grid ana-stats">
        <div className="s"><div className="l">Kokonaistuotto</div><div className={'v ' + (totalPnl >= 0 ? 'g' : 'r')}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {EURO}</div></div>
        <div className="s"><div className="l">ROI</div><div className={'v ' + (roi >= 0 ? 'g' : 'r')}>{roi >= 0 ? '+' : ''}{roi.toFixed(1)} %</div></div>
        <div className="s"><div className="l">Osumis-%</div><div className="v">{hitRate.toFixed(1)} %</div><div className="d">{settled.length} ratkenneesta</div></div>
        <div className="s"><div className="l">Kassa nyt</div><div className="v">{currentBankroll > 0 ? currentBankroll.toLocaleString('fi-FI', { maximumFractionDigits: 0 }) + ` ${EURO}` : '\u2014'}</div><div className="d">{rangeBets.length} vetoa</div></div>
      </div>

      <div className="ana-top">
        <div className="card ana-chart">
          <div className="row">
            <div>
              <div className="h">Kassan kehitys</div>
              <div className="big">{currentBankroll > 0 ? currentBankroll.toLocaleString('fi-FI') + ` ${EURO}` : '\u2014'}</div>
              <div className="delta">{totalPnl >= 0 ? '\u25b2' : '\u25bc'} {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {EURO}</div>
            </div>
          </div>
          <div className="chartbox">
            {bankrollArray.length < 2 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 13 }}>Aseta kassa profiilista, niin kassakäyrä päivittyy</div>
            ) : (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
                {(() => {
                  const mn = Math.min(...bankrollArray);
                  const mx = Math.max(...bankrollArray);
                  const pts = bankrollArray.map((v, i) => `${(i / (bankrollArray.length - 1)) * 100},${100 - ((v - mn) / (mx - mn || 1)) * 86 - 7}`).join(' ');
                  return (
                    <>
                      <defs>
                        <linearGradient id="bG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--blue)" stopOpacity=".25" />
                          <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polyline points={`${pts} 100,100 0,100`} fill="url(#bG)" stroke="none" />
                      <polyline points={pts} fill="none" stroke="var(--blue)" strokeWidth=".8" vectorEffect="non-scaling-stroke" />
                    </>
                  );
                })()}
              </svg>
            )}
          </div>
        </div>

        <div className="ana-side">
          <div className="card roi-sport-card">
            <div className="h"><span>Tuotto lajeittain</span><span>{settled.length} vetoa</span></div>
            <MetricBars rows={roiBySport} />
          </div>

          <div className="card">
            <div className="h"><span>Tuotto liigoittain</span><span>{settled.length} vetoa</span></div>
            <MetricBars rows={roiByLeague} />
          </div>
        </div>
      </div>

      <div className="ana-breakdowns">
        <div className="card">
          <div className="h"><span>Vetojen jakauma lajeittain</span><span>{rangeBets.length} vetoa</span></div>
          <SplitBars rows={sportSplit} />
        </div>
        <div className="card">
          <div className="h"><span>Vetojen jakauma liigoittain</span><span>{rangeBets.length} vetoa</span></div>
          <SplitBars rows={leagueSplit} />
        </div>
      </div>

      <div className="card" style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>Voitto / tappio per veto &middot; {pnlArray.length} viim.</div>
            <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 600, marginTop: 6 }}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(0)} {EURO}</div>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--tx3)' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--green)', marginRight: 6 }} />Voitto</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--red)', marginRight: 6 }} />Tappio</span>
          </div>
        </div>
        <BarChart pnl={pnlArray} />
      </div>

      <div className="card clv-analytics">
        <div className="clv-head">
          <div>
            <div className="h">CLV-analyysi</div>
            <div className="sub">Closing-line-arvot omista vedoista · {rangeLabel}</div>
          </div>
          <div className="clv-count">{clvBets.length} / {rangeBets.length} vetoa</div>
        </div>
        <div className="clv-summary">
          <div><span>Keski-CLV</span><b className={avgClv >= 0 ? 'g' : 'bad'}>{avgClv === null ? '-' : formatPct(avgClv, 2)}</b></div>
          <div><span>Positiivinen CLV</span><b>{positiveClvPct === null ? '-' : `${positiveClvPct.toFixed(0)}%`}</b></div>
          <div><span>Paras CLV</span><b className="g">{bestClv === null ? '-' : formatPct(bestClv, 2)}</b></div>
          <div><span>Heikoin CLV</span><b className={worstClv < 0 ? 'bad' : ''}>{worstClv === null ? '-' : formatPct(worstClv, 2)}</b></div>
        </div>
        {clvSegments.length === 0 ? (
          <div className="clv-empty">CLV-dataa ei ole vielä tällä aikavälillä. Arvot ilmestyvät, kun botti saa saman ottelun closing-linen simulaation CLV-haun yhteydessä.</div>
        ) : (
          <table className="clv-table">
            <thead>
              <tr>
                <th>Laji</th>
                <th>Liiga</th>
                <th>Markkina</th>
                <th className="ar">Vedot</th>
                <th className="ar">Keski-CLV</th>
                <th className="ar">Pos. CLV</th>
              </tr>
            </thead>
            <tbody>
              {clvSegments.map(s => (
                <tr key={s.key}>
                  <td>{s.sport}</td>
                  <td>{s.league}</td>
                  <td>{s.market}</td>
                  <td className="ar">{s.n}</td>
                  <td className={'ar mono ' + (s.avg >= 0 ? 'g' : 'bad')}>{formatPct(s.avg, 2)}</td>
                  <td className="ar mono">{s.hit.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}




