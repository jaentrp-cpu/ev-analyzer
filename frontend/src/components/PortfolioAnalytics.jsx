import React, { useState } from 'react';
import DatePicker from './DatePicker.jsx';
import {
  clvPhaseFromSource,
  deriveBetTaxonomy,
  isTrustedClvTiming,
} from '../supabase.js';

const EURO = '\u20ac';
const DAY_MS = 864e5;
const ANALYTICS_RANGES = new Set([
  'all',
  'today',
  'yesterday',
  'day_before_yesterday',
  '7d',
  '30d',
  '90d',
  'custom',
]);

const RESULT_META = {
  won: { label: 'Voitot', color: 'var(--green)' },
  half_won: { label: 'Half win', color: '#19a974' },
  lost: { label: 'Tappiot', color: 'var(--red)' },
  half_lost: { label: 'Half loss', color: '#c83f55' },
  push: { label: 'Palautukset', color: 'var(--blue)' },
  pending: { label: 'Kesken', color: '#d89b2b' },
};

export function normalizeAnalyticsRange(value) {
  return ANALYTICS_RANGES.has(value) ? value : '30d';
}

function parseBetTime(bet) {
  if (bet?.dateValue) {
    const parsed = new Date(bet.dateValue).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  const raw = String(bet?.date || '');
  const fi = raw.match(/^(\d{1,2})\.(\d{1,2})\.\s*(?:(\d{1,2})[.:](\d{2}))?/);
  if (fi) {
    const year = new Date().getFullYear();
    const parsed = new Date(
      year,
      Number(fi[2]) - 1,
      Number(fi[1]),
      Number(fi[3] || 0),
      Number(fi[4] || 0),
    ).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  const created = new Date(bet?.createdAt).getTime();
  return Number.isFinite(created) ? created : null;
}

function dayBounds(offsetDays) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);
  return [start.getTime(), start.getTime() + DAY_MS - 1];
}

export function betInAnalyticsRange(bet, range, from, to) {
  if (range === 'all') return true;
  const time = parseBetTime(bet);
  if (!Number.isFinite(time)) return true;
  const now = Date.now();
  if (range === 'today') {
    const [start, end] = dayBounds(0);
    return time >= start && time <= end;
  }
  if (range === 'yesterday') {
    const [start, end] = dayBounds(-1);
    return time >= start && time <= end;
  }
  if (range === 'day_before_yesterday') {
    const [start, end] = dayBounds(-2);
    return time >= start && time <= end;
  }
  if (range === '7d') return time >= now - 7 * DAY_MS && time <= now;
  if (range === '30d') return time >= now - 30 * DAY_MS && time <= now;
  if (range === '90d') return time >= now - 90 * DAY_MS && time <= now;
  if (range === 'custom') {
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : null;
    return (!Number.isFinite(fromTime) || time >= fromTime)
      && (!Number.isFinite(toTime) || time <= toTime);
  }
  return true;
}

function isSettled(bet) {
  return bet?.status !== 'pending';
}

function isWin(bet) {
  return bet?.status === 'won' || bet?.status === 'half_won';
}

function isLoss(bet) {
  return bet?.status === 'lost' || bet?.status === 'half_lost';
}

function hasStoredClv(bet) {
  return Number.isFinite(Number(bet?.clvOdds))
    && Number(bet.clvOdds) > 1
    && Number.isFinite(Number(bet?.clvPct));
}

function hasVerifiedClv(bet) {
  const phase = bet?.clvPhase || clvPhaseFromSource(bet?.clvSource);
  return bet?.clvVerified === true
    && ['closing', 'prestart', 'historical'].includes(phase)
    && hasStoredClv(bet)
    && isTrustedClvTiming(
      phase,
      bet?.clvCheckedAt,
      bet?.clvStartsAt || bet?.dateValue || bet?.date,
    );
}

function formatPct(value, digits = 1) {
  if (!Number.isFinite(Number(value))) return '-';
  const number = Number(value);
  return `${number >= 0 ? '+' : ''}${number.toFixed(digits)}%`;
}

function formatEuro(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return '-';
  return `${Number(value).toLocaleString('fi-FI', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${EURO}`;
}

function taxonomyOf(bet) {
  return deriveBetTaxonomy(bet);
}

function marketOf(bet) {
  return taxonomyOf(bet).market || bet?.market || 'Määrittämätön';
}

function summarize(bets, label = '') {
  const settled = bets.filter(isSettled);
  const decided = settled.filter(b => isWin(b) || isLoss(b));
  const wins = decided.filter(isWin).length;
  const stake = settled.reduce((sum, bet) => sum + (Number(bet.stake) || 0), 0);
  const pnl = settled.reduce((sum, bet) => sum + (Number(bet.pnl) || 0), 0);
  const clvRows = bets.filter(hasStoredClv);
  const clv = clvRows.length
    ? clvRows.reduce((sum, bet) => sum + Number(bet.clvPct), 0) / clvRows.length
    : null;
  return {
    label,
    bets: bets.length,
    n: settled.length,
    decided: decided.length,
    wins,
    stake,
    pnl,
    roi: stake > 0 ? (pnl / stake) * 100 : 0,
    hit: decided.length ? (wins / decided.length) * 100 : null,
    clv,
    clvN: clvRows.length,
  };
}

function groupSummaries(bets, getLabel) {
  const groups = new Map();
  bets.forEach(bet => {
    const label = String(getLabel(bet) || 'Määrittämätön').trim() || 'Määrittämätön';
    const rows = groups.get(label) || [];
    rows.push(bet);
    groups.set(label, rows);
  });
  return Array.from(groups.entries())
    .map(([label, rows]) => summarize(rows, label))
    .sort((a, b) => b.bets - a.bets || b.roi - a.roi);
}

function bucketSummaries(bets, definitions) {
  return definitions.map(def => summarize(
    bets.filter(bet => def.test(Number(def.value(bet)))),
    def.label,
  ));
}

function SectionTitle({ children, meta }) {
  return (
    <div className="portfolio-section-title">
      <span>{children}</span>
      {meta && <span>{meta}</span>}
    </div>
  );
}

function MetricRows({ rows, value = 'roi', empty = 'Ei dataa', maxRows = 12 }) {
  const shown = rows.filter(row => row.bets > 0 || row.n > 0).slice(0, maxRows);
  if (!shown.length) return <div className="portfolio-empty">{empty}</div>;
  const max = Math.max(...shown.map(row => Math.abs(Number(row[value]) || 0)), 1);
  return (
    <div className="portfolio-metric-rows">
      {shown.map(row => {
        const metric = Number(row[value]);
        const width = Math.max(2, (Math.abs(metric || 0) / max) * 100);
        return (
          <div className="portfolio-metric-row" key={row.label}>
            <div className="portfolio-metric-label">
              <span title={row.label}>{row.label}</span>
              <small>{row.n} ratk. / {row.bets} vetoa</small>
            </div>
            <div className="portfolio-metric-track">
              <span className={metric < 0 ? 'negative' : ''} style={{ width: `${width}%` }} />
            </div>
            <b className={metric < 0 ? 'bad' : 'g'}>{formatPct(metric)}</b>
          </div>
        );
      })}
    </div>
  );
}

function steamClvSummaries(bets) {
  const groups = new Map();
  bets.forEach(bet => {
    if (bet?.steamDisplayScore == null) return;
    const score = Number(bet.steamDisplayScore);
    const source = String(bet?.steamDisplaySource || '');
    if (!source || !Number.isFinite(score) || score < 0 || score > 100) return;
    const rounded = Math.round(score);
    const key = `${source}:${rounded}`;
    const group = groups.get(key) || { score: rounded, source, rows: [] };
    group.rows.push(bet);
    groups.set(key, group);
  });
  return Array.from(groups.entries())
    .map(([key, group]) => {
      const { score, source, rows } = group;
      // Steam remains a validation view: historical fallback CLV must not
      // influence rating-level CLV comparisons.
      const clvRows = rows.filter(hasVerifiedClv);
      const avgClv = clvRows.length
        ? clvRows.reduce((sum, bet) => sum + Number(bet.clvPct), 0) / clvRows.length
        : null;
      const positive = clvRows.filter(bet => Number(bet.clvPct) > 0).length;
      const levels = new Map();
      rows.forEach(bet => {
        const label = source === 'steam_rating_rules'
          ? bet.steamMatchLabel || 'opittu sääntö'
          : 'reaaliaikainen 0–58 → 0–100';
        levels.set(label, (levels.get(label) || 0) + 1);
      });
      const dominantLevel = Array.from(levels.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      return {
        key,
        score,
        source,
        bets: rows.length,
        clvN: clvRows.length,
        avgClv,
        positivePct: clvRows.length ? (positive / clvRows.length) * 100 : null,
        dominantLevel,
      };
    })
    .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source));
}

function SteamClvRows({ rows }) {
  if (!rows.length) {
    return (
      <div className="portfolio-empty">
        Ei Steam-arvolla ja CLV:llä yhdistettyjä vetoja valitulla aikavälillä.
      </div>
    );
  }
  return (
    <div className="steam-clv-rows">
      {rows.map(row => (
        <div className="steam-clv-row" key={row.key}>
          <strong>{row.score}/100</strong>
          <div>
            <span>{row.dominantLevel}</span>
            <small>{row.clvN}/{row.bets} vetoa CLV:llä</small>
          </div>
          <div className="steam-clv-stat">
            <small>AVG CLV</small>
            <b className={row.avgClv < 0 ? 'bad' : 'g'}>
              {row.avgClv === null ? '-' : formatPct(row.avgClv, 2)}
            </b>
          </div>
          <div className="steam-clv-stat">
            <small>CLV+</small>
            <b>{row.positivePct === null ? '-' : `${row.positivePct.toFixed(0)}%`}</b>
          </div>
        </div>
      ))}
    </div>
  );
}

function OutcomeDonut({ bets }) {
  const counts = Object.keys(RESULT_META).map(status => ({
    status,
    count: bets.filter(bet => bet.status === status).length,
    ...RESULT_META[status],
  }));
  const total = bets.length;
  let cursor = 0;
  const stops = counts.filter(row => row.count > 0).map(row => {
    const start = cursor;
    cursor += total ? (row.count / total) * 100 : 0;
    return `${row.color} ${start}% ${cursor}%`;
  });
  const background = stops.length
    ? `conic-gradient(${stops.join(',')})`
    : 'var(--bg3)';
  return (
    <div className="portfolio-donut-layout">
      <div className="portfolio-donut" style={{ background }}>
        <div>
          <b>{total}</b>
          <span>vetoa</span>
        </div>
      </div>
      <div className="portfolio-donut-legend">
        {counts.filter(row => row.count > 0).map(row => (
          <div key={row.status}>
            <i style={{ background: row.color }} />
            <span>{row.label}</span>
            <b>{row.count}</b>
            <small>{total ? ((row.count / total) * 100).toFixed(1) : '0.0'}%</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function PnlCurve({ settled, bankroll }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const chronological = [...settled].sort((a, b) => {
    const aTime = parseBetTime(a) ?? new Date(a.createdAt || 0).getTime();
    const bTime = parseBetTime(b) ?? new Date(b.createdAt || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    const aCreated = new Date(a.createdAt || 0).getTime();
    const bCreated = new Date(b.createdAt || 0).getTime();
    if (aCreated !== bCreated) return aCreated - bCreated;
    return String(a._dbId || '').localeCompare(String(b._dbId || ''));
  });
  const values = [0];
  chronological.forEach(bet => values.push(values[values.length - 1] + (Number(bet.pnl) || 0)));
  if (values.length < 2) return <div className="portfolio-chart-empty">Ei ratkaistuja vetoja valitulla aikavälillä.</div>;

  const width = 1000;
  const height = 280;
  const padding = 18;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const domainMin = min === max ? min - 1 : min;
  const domainMax = min === max ? max + 1 : max;
  const span = domainMax - domainMin;
  const points = values.map((point, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = padding + ((domainMax - point) / span) * (height - padding * 2);
    return [x, y];
  });
  const line = points.map(point => point.join(',')).join(' ');
  const zeroY = padding + ((domainMax - 0) / span) * (height - padding * 2);
  const area = `${line} ${width - padding},${zeroY} ${padding},${zeroY}`;
  const final = values[values.length - 1];
  const currentBankroll = Number(bankroll);
  const estimatedStartBankroll = Number.isFinite(currentBankroll) && currentBankroll > 0
    ? currentBankroll - final
    : null;
  const activeIndex = Number.isInteger(hoveredIndex)
    ? Math.min(Math.max(hoveredIndex, 1), chronological.length)
    : null;
  const activeBet = activeIndex ? chronological[activeIndex - 1] : null;
  const activePoint = activeIndex ? points[activeIndex] : null;
  const activeBankroll = activeIndex && estimatedStartBankroll !== null
    ? estimatedStartBankroll + values[activeIndex]
    : null;
  const activeBetNumber = activeBet && /^\d+$/.test(String(activeBet.sourceBetId || ''))
    ? String(activeBet.sourceBetId)
    : activeIndex;

  const setHoveredBetFromPointer = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const pointerX = ((event.clientX - rect.left) / rect.width) * width;
    const relativeIndex = Math.round(((pointerX - padding) / (width - padding * 2)) * (points.length - 1));
    setHoveredIndex(Math.min(Math.max(relativeIndex, 1), chronological.length));
  };

  return (
    <div className="portfolio-line-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Valitun aikavälin kumulatiivinen PnL. Kohdista hiiri käyrälle nähdäksesi vedon tiedot."
        onPointerMove={setHoveredBetFromPointer}
        onPointerLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="portfolioPnlGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--blue)" stopOpacity=".28" />
            <stop offset="100%" stopColor="var(--blue)" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(part => (
          <line key={part} x1={padding} x2={width - padding} y1={height * part} y2={height * part} className="grid-line" />
        ))}
        <line x1={padding} x2={width - padding} y1={zeroY} y2={zeroY} className="zero-line" />
        <polygon points={area} fill="url(#portfolioPnlGradient)" />
        <polyline points={line} fill="none" stroke="var(--blue)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        {activePoint && (
          <>
            <line x1={activePoint[0]} x2={activePoint[0]} y1={padding} y2={height - padding} className="hover-line" />
            <circle cx={activePoint[0]} cy={activePoint[1]} r="5" className="hover-point" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {activeBet && activePoint && (
        <div
          className={
            'portfolio-chart-tooltip'
            + (activePoint[0] / width > 0.68 ? ' align-end' : '')
            + (activePoint[1] / height < 0.38 ? ' below' : '')
          }
          style={{
            left: `${(activePoint[0] / width) * 100}%`,
            top: `${(activePoint[1] / height) * 100}%`,
          }}
          role="status"
        >
          <b>Veto #{activeBetNumber}</b>
          <span>{activeBet.date || 'Ajankohta puuttuu'}</span>
          {activeBet.match && <span>{activeBet.match}</span>}
          <span>Panos: {formatEuro(activeBet.stake)}</span>
          <span>Kumulatiivinen PnL: {values[activeIndex] >= 0 ? '+' : ''}{formatEuro(values[activeIndex])}</span>
          <span>Kassa (arvio): {activeBankroll === null ? '—' : formatEuro(activeBankroll)}</span>
        </div>
      )}
      <div className="portfolio-chart-scale">
        <span>Min {formatEuro(min)}</span>
        <span>Nollataso 0 {EURO} · {values.length - 1} ratkennutta</span>
        <span>Maks {formatEuro(max)} · Lopputulos {final >= 0 ? '+' : ''}{formatEuro(final)}</span>
      </div>
    </div>
  );
}

function ClvHistogram({ bets }) {
  const definitions = [
    { label: '< -3%', test: value => value < -3 },
    { label: '-3…-1%', test: value => value >= -3 && value < -1 },
    { label: '-1…0%', test: value => value >= -1 && value < 0 },
    { label: '0…1%', test: value => value >= 0 && value < 1 },
    { label: '1…3%', test: value => value >= 1 && value <= 3 },
    { label: '> 3%', test: value => value > 3 },
  ];
  const rows = definitions.map(def => ({
    ...def,
    n: bets.filter(bet => def.test(Number(bet.clvPct))).length,
  }));
  const max = Math.max(...rows.map(row => row.n), 1);
  return (
    <div className="portfolio-histogram">
      {rows.map((row, index) => (
        <div key={row.label}>
          <span>{row.n}</span>
          <i
            className={index < 3 ? 'negative' : index === 3 ? 'neutral' : 'positive'}
            style={{ height: `${Math.max(3, (row.n / max) * 100)}%` }}
          />
          <small>{row.label}</small>
        </div>
      ))}
    </div>
  );
}

function ClvResultRows({ bets }) {
  const order = ['won', 'half_won', 'lost', 'half_lost', 'push', 'pending'];
  const rows = order.map(status => {
    const matching = bets.filter(bet => bet.status === status && hasStoredClv(bet));
    return {
      label: RESULT_META[status].label,
      n: matching.length,
      avg: matching.length
        ? matching.reduce((sum, bet) => sum + Number(bet.clvPct), 0) / matching.length
        : null,
      positive: matching.length
        ? (matching.filter(bet => Number(bet.clvPct) > 0).length / matching.length) * 100
        : null,
    };
  }).filter(row => row.n > 0);
  if (!rows.length) return <div className="portfolio-empty">CLV-dataa ei ole valitulla aikavälillä.</div>;
  const max = Math.max(...rows.map(row => Math.abs(row.avg)), 1);
  return (
    <div className="portfolio-clv-result-rows">
      {rows.map(row => (
        <div key={row.label}>
          <div><span>{row.label}</span><small>{row.n} vetoa · {row.positive.toFixed(0)}% CLV+</small></div>
          <div className="portfolio-metric-track">
            <span className={row.avg < 0 ? 'negative' : ''} style={{ width: `${Math.max(2, (Math.abs(row.avg) / max) * 100)}%` }} />
          </div>
          <b className={row.avg < 0 ? 'bad' : 'g'}>{formatPct(row.avg, 2)}</b>
        </div>
      ))}
    </div>
  );
}

function SegmentTable({ title, rows, empty = 'Ei dataa', limit = 10 }) {
  const shown = rows.filter(row => row.bets > 0).slice(0, limit);
  return (
    <div className="portfolio-segment-panel">
      <h4>{title}</h4>
      {shown.length === 0 ? (
        <div className="portfolio-empty">{empty}</div>
      ) : (
        <table>
          <thead>
            <tr><th>Segmentti</th><th>Vedot</th><th>CLV</th><th>ROI</th></tr>
          </thead>
          <tbody>
            {shown.map(row => (
              <tr key={row.label}>
                <td><b>{row.label}</b><small>{row.decided ? `Osuma ${row.hit.toFixed(0)}%` : 'Ei W/L-ratkaisuja'}</small></td>
                <td>{row.bets}</td>
                <td className={row.clv !== null && row.clv < 0 ? 'bad' : 'g'}>{row.clv === null ? '-' : formatPct(row.clv, 2)}</td>
                <td className={row.roi < 0 ? 'bad' : 'g'}>{row.n ? formatPct(row.roi) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TimingTable({ bets }) {
  const timed = bets.map(bet => {
    const start = parseBetTime(bet);
    const placed = new Date(bet.createdAt || 0).getTime();
    const hours = Number.isFinite(start) && Number.isFinite(placed) ? (start - placed) / 36e5 : null;
    return { ...bet, hoursBeforeStart: hours };
  }).filter(bet => Number.isFinite(bet.hoursBeforeStart) && bet.hoursBeforeStart >= 0 && hasStoredClv(bet));
  const definitions = [
    { label: '0–30 min', min: 0, max: 0.5 },
    { label: '30–60 min', min: 0.5, max: 1 },
    { label: '1–2 h', min: 1, max: 2 },
    { label: '2–4 h', min: 2, max: 4 },
    { label: '4–8 h', min: 4, max: 8 },
    { label: '8–12 h', min: 8, max: 12 },
    { label: '12–24 h', min: 12, max: 24 },
    { label: 'Yli 24 h', min: 24, max: Infinity },
  ];
  const rows = definitions.map(def => summarize(
    timed.filter(bet => bet.hoursBeforeStart >= def.min && bet.hoursBeforeStart < def.max),
    def.label,
  )).filter(row => row.bets > 0);
  return (
    <div className="portfolio-timing-table">
      <div className="portfolio-coverage-note">
        Ajankohta tunnetaan {timed.length}/{bets.filter(hasStoredClv).length} CLV-rivillä. Aika = vedon lisäyshetki suhteessa ottelun alkuun.
      </div>
      {rows.length === 0 ? (
        <div className="portfolio-empty">Tarkkaa veto- ja alkamisaikaa ei ole vielä riittävästi.</div>
      ) : (
        <table>
          <thead><tr><th>Aikaväli ennen alkua</th><th>Vedot</th><th>CLV ka.</th><th>CLV+</th><th>ROI</th><th>EV ka.</th></tr></thead>
          <tbody>
            {rows.map(row => {
              const matching = timed.filter(bet => {
                const def = definitions.find(item => item.label === row.label);
                return bet.hoursBeforeStart >= def.min && bet.hoursBeforeStart < def.max;
              });
              const positive = matching.length
                ? (matching.filter(bet => Number(bet.clvPct) > 0).length / matching.length) * 100
                : null;
              const avgEv = matching.length
                ? matching.reduce((sum, bet) => sum + (Number(bet.ev) || 0), 0) / matching.length
                : null;
              return (
                <tr key={row.label}>
                  <td><b>{row.label}</b></td>
                  <td>{row.bets}</td>
                  <td className={row.clv < 0 ? 'bad' : 'g'}>{formatPct(row.clv, 2)}</td>
                  <td>{positive === null ? '-' : `${positive.toFixed(0)}%`}</td>
                  <td className={row.roi < 0 ? 'bad' : 'g'}>{row.n ? formatPct(row.roi) : '-'}</td>
                  <td>{avgEv === null ? '-' : formatPct(avgEv, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SportLeagueAnalysis({ bets }) {
  const sports = groupSummaries(bets, bet => taxonomyOf(bet).sport);
  const [selectedSport, setSelectedSport] = useState('');
  const activeSport = sports.some(row => row.label === selectedSport)
    ? selectedSport
    : sports[0]?.label || '';
  const sportBets = bets.filter(bet => taxonomyOf(bet).sport === activeSport);
  const leagues = groupSummaries(sportBets, bet => taxonomyOf(bet).league);
  const active = sports.find(row => row.label === activeSport);
  if (!sports.length) return <div className="portfolio-empty">Laji- ja liigadataa ei ole.</div>;
  return (
    <div className="portfolio-sport-league">
      <div className="portfolio-sport-list">
        {sports.map(row => (
          <button
            key={row.label}
            className={row.label === activeSport ? 'on' : ''}
            onClick={() => setSelectedSport(row.label)}
          >
            <b>{row.label}</b>
            <span>{row.bets} vetoa · ROI {row.n ? formatPct(row.roi) : '-'}</span>
            <i><span style={{ width: `${Math.max(3, (row.bets / Math.max(...sports.map(item => item.bets), 1)) * 100)}%` }} /></i>
          </button>
        ))}
      </div>
      <div className="portfolio-league-detail">
        <div className="portfolio-league-head">
          <div><b>{activeSport}</b><span>{active?.bets || 0} vetoa</span></div>
          <div><span>Panokset {formatEuro(active?.stake || 0)}</span><span>Tuotto {formatEuro(active?.pnl || 0)}</span><span>ROI {active?.n ? formatPct(active.roi) : '-'}</span></div>
        </div>
        <table>
          <thead><tr><th>Liiga</th><th>Vedot</th><th>Osuus</th><th>Osuma</th><th>CLV</th><th>ROI</th></tr></thead>
          <tbody>
            {leagues.map(row => (
              <tr key={row.label}>
                <td><b>{row.label}</b></td>
                <td>{row.bets}</td>
                <td>{sportBets.length ? ((row.bets / sportBets.length) * 100).toFixed(1) : '0.0'}%</td>
                <td>{row.hit === null ? '-' : `${row.hit.toFixed(1)}%`}</td>
                <td className={row.clv !== null && row.clv < 0 ? 'bad' : 'g'}>{row.clv === null ? '-' : formatPct(row.clv, 2)}</td>
                <td className={row.roi < 0 ? 'bad' : 'g'}>{row.n ? formatPct(row.roi) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PortfolioAnalytics({
  userBets,
  bankroll,
  canViewAdvanced,
  range = '30d',
  dateFrom = '',
  dateTo = '',
  onRangeChange = () => {},
  onDateFromChange = () => {},
  onDateToChange = () => {},
}) {
  if (!canViewAdvanced) {
    return (
      <div className="card portfolio-locked">
        <div>
          <span>Analytiikka</span>
          <h3>Vetohistoria on käytössäsi</h3>
          <p>Laajemmat ROI-, CLV-, Steam-, laji- ja liigaanalyysit kuuluvat All-Star-pakettiin.</p>
        </div>
        <span className="portfolio-lock-badge">All-Star</span>
      </div>
    );
  }

  const rangeBets = userBets.filter(bet => betInAnalyticsRange(bet, range, dateFrom, dateTo));
  const settled = rangeBets.filter(isSettled);
  const decided = settled.filter(bet => isWin(bet) || isLoss(bet));
  const wins = decided.filter(isWin);
  const totalStake = settled.reduce((sum, bet) => sum + (Number(bet.stake) || 0), 0);
  const totalPnl = settled.reduce((sum, bet) => sum + (Number(bet.pnl) || 0), 0);
  const roi = totalStake > 0 ? (totalPnl / totalStake) * 100 : 0;
  const hit = decided.length ? (wins.length / decided.length) * 100 : null;
  // General portfolio analytics preserves the historical series. dbBetToLocal
  // has already replaced a legacy value with the exact source observation when
  // one exists, so every bet contributes at most one effective CLV value.
  const clvBets = rangeBets.filter(hasStoredClv);
  const verifiedClvBets = clvBets.filter(hasVerifiedClv);
  const historicalClvBets = clvBets.filter(bet => !hasVerifiedClv(bet));
  const avgClv = clvBets.length
    ? clvBets.reduce((sum, bet) => sum + Number(bet.clvPct), 0) / clvBets.length
    : null;
  const positiveClv = clvBets.filter(bet => Number(bet.clvPct) > 0);
  const clvPhase = bet => bet.clvPhase || clvPhaseFromSource(bet.clvSource);
  const closingClvCount = verifiedClvBets.filter(bet => clvPhase(bet) === 'closing').length;
  const preStartClvCount = verifiedClvBets.filter(bet => clvPhase(bet) === 'prestart').length;
  const historicalClvCount = historicalClvBets.length;
  const otherStoredClvCount = verifiedClvBets.length - closingClvCount - preStartClvCount;
  const bestClv = clvBets.length ? Math.max(...clvBets.map(bet => Number(bet.clvPct))) : null;
  const worstClv = clvBets.length ? Math.min(...clvBets.map(bet => Number(bet.clvPct))) : null;
  const open = rangeBets.filter(bet => bet.status === 'pending').length;
  const openBets = userBets.filter(bet => bet.status === 'pending');
  const openStake = openBets.reduce((sum, bet) => sum + (Number(bet.stake) || 0), 0);

  const evRows = bucketSummaries(settled, [
    { label: 'EV alle 0%', value: bet => bet.ev, test: value => value < 0 },
    { label: 'EV 0–3%', value: bet => bet.ev, test: value => value >= 0 && value < 3 },
    { label: 'EV 3–4%', value: bet => bet.ev, test: value => value >= 3 && value < 4 },
    { label: 'EV 4–5%', value: bet => bet.ev, test: value => value >= 4 && value < 5 },
    { label: 'EV 5–6%', value: bet => bet.ev, test: value => value >= 5 && value < 6 },
    { label: 'EV 6–8%', value: bet => bet.ev, test: value => value >= 6 && value < 8 },
    { label: 'EV 8%+', value: bet => bet.ev, test: value => value >= 8 },
  ]);
  const oddsRows = bucketSummaries(settled, [
    { label: 'Alle 1.80', value: bet => bet.odds, test: value => value < 1.8 },
    { label: '1.80–2.00', value: bet => bet.odds, test: value => value >= 1.8 && value < 2 },
    { label: '2.00–2.20', value: bet => bet.odds, test: value => value >= 2 && value < 2.2 },
    { label: '2.20–2.50', value: bet => bet.odds, test: value => value >= 2.2 && value < 2.5 },
    { label: '2.50–3.00', value: bet => bet.odds, test: value => value >= 2.5 && value < 3 },
    { label: '3.00–3.50', value: bet => bet.odds, test: value => value >= 3 && value <= 3.5 },
    { label: 'Yli 3.50', value: bet => bet.odds, test: value => value > 3.5 },
  ]);
  const marketRows = groupSummaries(settled, marketOf);
  const steamDisplayBets = rangeBets.filter(bet =>
    bet?.steamDisplayScore != null
    && Number.isFinite(Number(bet.steamDisplayScore))
  );
  const steamClvRows = steamClvSummaries(rangeBets);
  const steamDisplayWithClv = steamDisplayBets.filter(hasVerifiedClv).length;
  const sportRows = groupSummaries(rangeBets, bet => taxonomyOf(bet).sport);
  const leagueRows = groupSummaries(rangeBets, bet => taxonomyOf(bet).league);
  const clvMarketRows = groupSummaries(rangeBets, marketOf);

  const rangeLabel = range === 'all' ? 'kaikki vedot'
    : range === 'today' ? 'tänään'
    : range === 'yesterday' ? 'eilen'
    : range === 'day_before_yesterday' ? 'toissapäivänä'
    : range === '7d' ? 'viimeiset 7 päivää'
    : range === '30d' ? 'viimeiset 30 päivää'
    : range === '90d' ? 'viimeiset 90 päivää'
    : 'valittu aikaväli';

  return (
    <section className="portfolio-analytics">
      <div className="portfolio-toolbar">
        <div>
          <span>Analytiikka</span>
          <h2>Omat tulokset</h2>
          <p>Kaikki luvut perustuvat vain omiin tallennettuihin vetoihisi · {rangeLabel} · {rangeBets.length}/{userBets.length} vetoa valittuna · tallennetun otteluajan mukaan, puuttuessa lisäysajan mukaan</p>
        </div>
        <div className="filters compact analytics-range">
          <label className="filter-field narrow">
            <span>Aika</span>
            <select value={range} onChange={event => onRangeChange(event.target.value)}>
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
              <label className="filter-field date"><span>Alkaen</span><DatePicker value={dateFrom} onChange={onDateFromChange} /></label>
              <label className="filter-field date"><span>Asti</span><DatePicker value={dateTo} onChange={onDateToChange} /></label>
            </>
          )}
        </div>
      </div>

      <div className="stat-grid portfolio-stats">
        <div className="s">
          <div className="l">Kassa nyt</div>
          <div className="v">{bankroll > 0 ? formatEuro(bankroll) : '—'}</div>
          <div className={'d ' + (totalPnl >= 0 ? 'g' : 'r')}>{totalPnl >= 0 ? '+' : ''}{formatEuro(totalPnl)} · ROI {formatPct(roi)}</div>
        </div>
        <div className="s">
          <div className="l">Osumisprosentti</div>
          <div className="v">{hit === null ? '—' : `${hit.toFixed(1)}%`}</div>
          <div className="d">{wins.length} voittoa / {decided.length} W/L-ratkaisua</div>
        </div>
        <div className="s">
          <div className="l">AVG CLV</div>
          <div className={'v ' + (avgClv !== null && avgClv < 0 ? 'r' : 'g')}>{avgClv === null ? '—' : formatPct(avgClv, 2)}</div>
          <div className="d">
            {clvBets.length}/{rangeBets.length} vetoa CLV:llä · varmennettu {verifiedClvBets.length} · historiallinen {historicalClvBets.length}
          </div>
        </div>
        <div className="s">
          <div className="l">Vetoja aikavälillä</div>
          <div className="v">{rangeBets.length}</div>
          <div className="d">{open} kesken · {settled.length} ratkaistu · {userBets.length} kaikkiaan</div>
        </div>
        <div className="s">
          <div className="l">Avoimet panokset</div>
          <div className="v">{formatEuro(openStake)}</div>
          <div className="d">{openBets.length} kesken kaikkiaan{open !== openBets.length ? ` · ${open} valitulla ajalla` : ''}</div>
        </div>
      </div>

      <div className="portfolio-grid two">
        <div className="card portfolio-panel">
          <SectionTitle meta={`${rangeBets.length} vetoa`}>Tulosjakauma</SectionTitle>
          <OutcomeDonut bets={rangeBets} />
        </div>
        <div className="card portfolio-panel">
          <SectionTitle meta="Osuma = W/L-ratkaisut">ROI per EV-taso</SectionTitle>
          <MetricRows rows={evRows} />
          <div className="portfolio-coverage-note">Manuaalivedon puuttuva EV tallentuu nykyisessä datassa arvoksi 0%.</div>
        </div>
      </div>

      <div className="card portfolio-panel portfolio-curve-card">
        <div className="portfolio-curve-head">
          <div>
            <SectionTitle meta={`${settled.length} ratkennutta`}>Kumulatiivinen PnL</SectionTitle>
            <strong className={totalPnl < 0 ? 'bad' : 'g'}>{totalPnl >= 0 ? '+' : ''}{formatEuro(totalPnl)}</strong>
            <p>Lähtötaso on 0 {EURO}. Käyrä näyttää valitun jakson kumulatiivisen PnL:n, ei historiallista kassan saldoa tai kassasnapshotteja.</p>
          </div>
        </div>
        <PnlCurve settled={settled} bankroll={bankroll} />
      </div>

      <div className="portfolio-grid two">
        <div className="card portfolio-panel">
          <SectionTitle meta={`${marketRows.length} markkinaa`}>ROI per markkina</SectionTitle>
          <MetricRows rows={marketRows} />
        </div>
        <div className="card portfolio-panel">
          <SectionTitle meta={`${steamDisplayWithClv}/${steamDisplayBets.length} Steam-vetoa CLV:llä`}>
            CLV per Steam-arvo
          </SectionTitle>
          <SteamClvRows rows={steamClvRows} />
          <div className="portfolio-coverage-note">
            Vain varmennetut CLV-rivit. Opittu rating näytetään ensisijaisena. Muuten reaaliaikainen 0–58 signaali skaalataan kaavalla arvo / 58 × 100; lähteet pidetään erillisinä.
          </div>
        </div>
      </div>

      <div className="portfolio-grid two">
        <div className="card portfolio-panel">
          <SectionTitle meta={`${settled.length} ratkennutta`}>ROI per kerroinväli</SectionTitle>
          <MetricRows rows={oddsRows} maxRows={20} />
        </div>
        <div className="card portfolio-panel">
          <SectionTitle meta={`${clvBets.length} CLV-riviä · ${verifiedClvBets.length} varmennettua`}>
            CLV-jakauma
          </SectionTitle>
          <ClvHistogram bets={clvBets} />
        </div>
      </div>

      <div className="portfolio-grid two">
        <div className="card portfolio-panel">
          <SectionTitle meta="Viite-CLV · closing ensisijainen">CLV tuloksen mukaan</SectionTitle>
          <ClvResultRows bets={rangeBets} />
        </div>
        <div className="card portfolio-panel">
          <SectionTitle meta={`${clvBets.length}/${rangeBets.length} vetoa`}>CLV-yhteenveto</SectionTitle>
          <div className="portfolio-summary-grid">
            <div><span>AVG CLV</span><b className={avgClv !== null && avgClv < 0 ? 'bad' : 'g'}>{avgClv === null ? '-' : formatPct(avgClv, 2)}</b><small>{clvBets.length} vetoa</small></div>
            <div><span>CLV+</span><b>{clvBets.length ? `${((positiveClv.length / clvBets.length) * 100).toFixed(0)}%` : '-'}</b><small>positiivinen viite-CLV</small></div>
            <div><span>Paras CLV</span><b className="g">{bestClv === null ? '-' : formatPct(bestClv, 2)}</b><small>valitulla jaksolla</small></div>
            <div><span>Heikoin CLV</span><b className={worstClv !== null && worstClv < 0 ? 'bad' : ''}>{worstClv === null ? '-' : formatPct(worstClv, 2)}</b><small>valitulla jaksolla</small></div>
          </div>
          <div className="portfolio-coverage-note">
            Viitelähteet: closing {closingClvCount}, pre-start {preStartClvCount}, historiallinen {historicalClvCount}, muu tallennettu {otherStoredClvCount}.
            {' '}Uusi varmennettu lähde korvaa aina saman vedon historiallisen arvon. Steam–CLV käyttää vain varmennettuja rivejä.
          </div>
        </div>
      </div>

      <div className="card portfolio-panel">
        <SectionTitle meta="Laji, liiga ja markkina">CLV segmentin mukaan</SectionTitle>
        <div className="portfolio-segments">
          <SegmentTable title="Laji" rows={sportRows} />
          <SegmentTable title="Markkina" rows={clvMarketRows} />
          <SegmentTable title="Liiga" rows={leagueRows} limit={14} />
        </div>
      </div>

      <div className="card portfolio-panel">
        <SectionTitle meta="Vetohetki suhteessa ottelun alkuun">CLV aikavälin mukaan</SectionTitle>
        <TimingTable bets={rangeBets} />
      </div>

      <div className="card portfolio-panel">
        <SectionTitle meta={`${rangeBets.length} vetoa`}>Laji & liiga -analyysi</SectionTitle>
        <SportLeagueAnalysis bets={rangeBets} />
      </div>
    </section>
  );
}
