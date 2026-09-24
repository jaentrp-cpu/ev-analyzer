import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  adjustArbWallet, closeArbAttempt, correctArbLeg, createArbAttempt, loadArbTracker,
  markArbLegUnavailable, openArbWallet, placeArbLeg, settleArbLeg,
  setArbAnalyticsConsent, transferArbWallet,
} from '../arb-tracker.js';
import { arbAttemptMetrics, arbOfferTermsChanged, arbPlacedScenario, describeArbOfferChange } from '../arb-metrics.js';
import { createArbTrackerRequestScope } from '../arb-tracker-request-scope.js';
import { canRecordWalletMovement } from '../arb-wallet-input.js';
import { normalizeBookName } from '../supabase.js';

const money = n => Number(n || 0).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const cashKindLabel = {
  opening: 'Alkusaldo', stake: 'Arbitraasivedon panos', return: 'Arbitraasivedon palautus',
  correction: 'Vedon oikaisu', deposit: 'Lisäys', withdrawal: 'Vähennys',
  transfer_out: 'Siirto ulos', transfer_in: 'Siirto sisään', reconcile: 'Saldon täsmäytys',
};
const fmt = date => date ? new Date(date).toLocaleString('fi-FI') : 'ei mitattu';
const attemptStatusLabel = {
  started: 'Kesken', partial: 'Osittain toteutunut', placed: 'Kaikki jalat asetettu',
  rejected: 'Hylätty', abandoned: 'Keskeytetty', settled: 'Ratkaistu',
  failed: 'Ei toteutunut kokonaan',
};
const arbErrorMessage = error => {
  const code = String(error?.message || '');
  if (code.includes('offer_changed_refresh_required') || code.includes('offer_not_active'))
    return 'Tarjous muuttui tai poistui. Päivitä tarjouslista ennen uutta yritystä.';
  if (code.includes('insufficient_virtual_balance'))
    return 'Kassassa ei ole riittävästi seurantasaldoa. Kirjausta ei tehty.';
  if (code.includes('virtual_wallet_missing'))
    return 'Virtuaalikassaa ei löytynyt. Päivitä kassalista ja yritä uudelleen.';
  if (code.includes('wallet_balance_unchanged'))
    return 'Täsmäytys ei muuttaisi saldoa. Kirjausta ei tehty.';
  if (code.includes('invalid_wallet_movement'))
    return 'Tarkista kassamuutoksen summa, kohde ja perustelu.';
  if (code.includes('leg_not_placeable') || code.includes('leg_not_settleable'))
    return 'Jalan tila muuttui jo. Päivitä yritykset ennen uutta kirjausta.';
  if (code.includes('duplicate key'))
    return 'Sama kirjaus on jo tehty. Päivitä tiedot ja tarkista yrityksen tila.';
  return 'Kirjaus epäonnistui. Päivitä tiedot ennen kuin yrität uudelleen.';
};

export function useArbTracker(enabled, userId) {
  const scopeRef = useRef(null);
  if (!scopeRef.current) scopeRef.current = createArbTrackerRequestScope(enabled, userId);
  else scopeRef.current.update(enabled, userId);
  const emptyData = { attempts: [], legs: [], corrections: [], wallets: [], cashEntries: [], consent: false };
  const [data, setData] = useState({ ...emptyData, ownerId: null });
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    if (!enabled) return;
    const ticket = scopeRef.current.beginLoad();
    try {
      const loaded = await loadArbTracker();
      if (!scopeRef.current.ownsLoad(ticket)) return;
      setData({ ...loaded, ownerId: userId });
      setLoadError('');
    } catch {
      if (scopeRef.current.ownsLoad(ticket))
        setLoadError('Arbitraasiseuranta ei ole vielä käytettävissä. Tarjouslista toimii edelleen.');
    }
  }, [enabled, userId]);
  useEffect(() => {
    setBusy(false);
    setData({ ...emptyData, ownerId: userId });
    setLoadError('');
    setActionError('');
    void reload();
  }, [reload, userId]);
  async function run(action) {
    if (loadError) return false;
    const ticket = scopeRef.current.beginAction();
    if (!ticket) return false;
    setBusy(true);
    setActionError('');
    try {
      await action();
      if (!scopeRef.current.ownsAction(ticket)) return false;
      await reload();
      return true;
    }
    catch (e) {
      if (!scopeRef.current.ownsAction(ticket)) return false;
      await reload();
      if (scopeRef.current.ownsAction(ticket)) setActionError(arbErrorMessage(e));
      return false;
    }
    finally {
      if (scopeRef.current.finishAction(ticket)) {
        setBusy(false);
      }
    }
  }
  return {
    ...(enabled && data.ownerId === userId ? data : emptyData),
    error: loadError, actionError, busy, reload, run,
  };
}

function LegEditor({ leg, tracker, attemptStatus }) {
  const [book, setBook] = useState(leg.actual_book || normalizeBookName(leg.offered_book));
  const [odds, setOdds] = useState(leg.actual_odds || leg.offered_odds);
  const [stake, setStake] = useState('');
  const [reason, setReason] = useState('');
  const [changedOdds, setChangedOdds] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [correctionBook, setCorrectionBook] = useState(leg.actual_book || '');
  const [correctionOdds, setCorrectionOdds] = useState(leg.actual_odds || '');
  const [correctionStake, setCorrectionStake] = useState(leg.actual_stake || '');
  const [correctionResult, setCorrectionResult] = useState(leg.result || '');
  const [correctionReason, setCorrectionReason] = useState('');
  useEffect(() => {
    setCorrectionBook(leg.actual_book || '');
    setCorrectionOdds(leg.actual_odds || '');
    setCorrectionStake(leg.actual_stake || '');
    setCorrectionResult(leg.result || '');
  }, [leg.effectiveCorrectionId, leg.status, leg.result, leg.returned_amount]);
  const history = tracker.corrections.filter(c => c.leg_id === leg.id)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  return (
    <div className="arb-track-leg">
      <div><b>{leg.offered_outcome}</b> · {leg.offered_book} @ {leg.offered_odds} · {leg.status}</div>
      {leg.status === 'pending' && ['started', 'partial'].includes(attemptStatus) && <>
        <div className="arb-track-row">
          <label>Bookkeri<input value={book} onChange={e => setBook(e.target.value)} /></label>
          <label>Todellinen kerroin<input type="number" step=".01" min="1.01" value={odds} onChange={e => setOdds(e.target.value)} /></label>
          <label>Todellinen panos €<input type="number" step=".01" min=".01" value={stake} onChange={e => setStake(e.target.value)} /></label>
          <button className="btn p" disabled={tracker.busy || !Number(stake)} onClick={() => tracker.run(() => placeArbLeg(leg.id, book, Number(odds), Number(stake)))}>Laitoin vedon</button>
        </div>
        <div className="arb-track-row">
          <input aria-label="Miksi jalka jäi pelaamatta" placeholder="Syy: kerroin muuttui, kohde suljettu..." value={reason} onChange={e => setReason(e.target.value)} />
          <input aria-label="Havaittu muuttunut kerroin" type="number" step=".01" min="1.01" placeholder="Uusi kerroin" value={changedOdds} onChange={e => setChangedOdds(e.target.value)} />
          <button className="btn" disabled={tracker.busy || !reason.trim()} onClick={() => tracker.run(() => markArbLegUnavailable(leg.id, reason, changedOdds ? Number(changedOdds) : null))}>Ei onnistunut</button>
        </div>
      </>}
      {leg.status === 'placed' && <>
        <div>Toteutui: {leg.actual_book} @ {leg.actual_odds}, {money(leg.actual_stake)} · {fmt(leg.placed_at)}</div>
        <div className="arb-track-row">{[['win', 'Voitto'], ['lose', 'Tappio'], ['void', 'Mitätöity']].map(([value, label]) =>
          <button className="btn" key={value} disabled={tracker.busy} onClick={() => tracker.run(() => settleArbLeg(leg.id, value))}>{label}</button>)}</div>
      </>}
      {leg.status === 'settled' && <div>Tulos: {leg.result} · palautus {money(leg.returned_amount)}</div>}
      {leg.status === 'unavailable' && <div>Ei toteutunut: {leg.failure_reason}{leg.actual_odds ? ` · havaittu kerroin ${leg.actual_odds}` : ''}</div>}
      {['placed', 'settled'].includes(leg.status) && <>
        <button className="btn" disabled={tracker.busy} onClick={() => setCorrecting(value => !value)}>
          {correcting ? 'Sulje oikaisu' : 'Tee erillinen oikaisumerkintä'}
        </button>
        {correcting && <div className="arb-track-row">
          <label>Oikaistu bookkeri<input value={correctionBook} onChange={e => setCorrectionBook(e.target.value)} /></label>
          <label>Oikaistu kerroin<input type="number" min="1.01" step=".01" value={correctionOdds} onChange={e => setCorrectionOdds(e.target.value)} /></label>
          <label>Oikaistu panos €<input type="number" min=".01" step=".01" value={correctionStake} onChange={e => setCorrectionStake(e.target.value)} /></label>
          {leg.status === 'settled' && <label>Oikaistu tulos<select value={correctionResult} onChange={e => setCorrectionResult(e.target.value)}>
            <option value="win">Voitto</option><option value="lose">Tappio</option><option value="void">Mitätöity</option>
          </select></label>}
          <label>Oikaisun syy<input value={correctionReason} onChange={e => setCorrectionReason(e.target.value)} /></label>
          <button className="btn p" disabled={tracker.busy || !correctionReason.trim() || !correctionBook.trim() ||
            !(Number(correctionOdds) > 1) || !(Number(correctionStake) > 0) || (leg.status === 'settled' && !correctionResult)}
            onClick={async () => {
              if (!window.confirm('Kirjataanko erillinen oikaisu? Alkuperäinen jalka ja aiemmat oikaisut säilyvät. Virtuaalikassa muuttuu erotuksen verran.')) return;
              if (await tracker.run(() => correctArbLeg(leg.id, correctionReason, correctionBook,
                Number(correctionOdds), Number(correctionStake), leg.status === 'settled' ? correctionResult : null))) {
                setCorrectionReason('');
                setCorrecting(false);
              }
            }}>Kirjaa oikaisu</button>
        </div>}
        {history.length > 0 && <div className="arb-track-history">
          <b>Oikaisuhistoria ({history.length})</b>
          {history.map(c => <div key={c.id}>{fmt(c.created_at)} · {c.reason} · {c.actual_book} @ {c.actual_odds},
            {' '}{money(c.actual_stake)}{c.result ? ` · ${c.result} · palautus ${money(c.returned_amount)}` : ''}</div>)}
        </div>}
      </>}
    </div>
  );
}

export default function ArbTracker({ tracker, offers, tab }) {
  const [book, setBook] = useState('');
  const [opening, setOpening] = useState('');
  const [movementBook, setMovementBook] = useState('');
  const [movementKind, setMovementKind] = useState('deposit');
  const [movementTarget, setMovementTarget] = useState('');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  useEffect(() => {
    setMovementBook('');
    setMovementTarget('');
    setMovementAmount('');
    setMovementReason('');
  }, [tracker.ownerId]);
  const metrics = useMemo(() => arbAttemptMetrics(tracker.attempts, tracker.legs), [tracker.attempts, tracker.legs]);
  if (tracker.error) return <div className="card arb-track-panel" role="status">{tracker.error}<button className="btn" onClick={tracker.reload}>Yritä uudelleen</button></div>;
  const actionMessage = tracker.actionError && <div className="card arb-track-panel" role="alert">Kirjaus epäonnistui: {tracker.actionError}</div>;
  if (tab === 'wallets') return (
    <div className="card arb-track-panel">
      {actionMessage}
      <h2>Omat virtuaalikassat</h2>
      <p>Nämä ovat itse kirjaamiasi seurantasaldoja, eivät bookkerilta automaattisesti luettuja saldoja. Alkusaldo annetaan kerran; myöhemmät muutokset kirjataan erikseen.</p>
      <div className="arb-track-row">
        <label>Bookkeri<input value={book} onChange={e => setBook(e.target.value)} /></label>
        <label>Alkusaldo €<input type="number" min="0" step=".01" value={opening} onChange={e => setOpening(e.target.value)} /></label>
        <button className="btn p" disabled={tracker.busy || !book.trim() || opening === ''} onClick={() => tracker.run(() => openArbWallet(book, Number(opening)))}>Aseta alkusaldo</button>
      </div>
      {tracker.wallets.map(w => <div className="arb-track-row" key={w.bookmaker}><b>{w.bookmaker}</b><span>Alku {money(w.opening_balance)}</span><span>Nykyinen {money(w.balance)}{Number(w.balance) < 0 ? ' · oikaisun jälkeinen alijäämä' : ''}</span></div>)}
      {tracker.wallets.length > 0 && <>
        <h3>Kirjaa kassamuutos</h3>
        <p>Lisäys ja vähennys kuvaavat kassaan tekemääsi muuta rahaliikettä. Siirto muuttaa kahta omaa kassaa samalla kirjauksella. Täsmäytys asettaa seurantasaldon syöttämääsi lukemaan ja tallentaa erotuksen historiaan.</p>
        <div className="arb-track-row">
          <label>Toiminto<select value={movementKind} onChange={e => setMovementKind(e.target.value)}>
            <option value="deposit">Lisäys</option><option value="withdrawal">Vähennys</option>
            <option value="transfer">Siirto kassojen välillä</option><option value="reconcile">Täsmäytä saldo</option>
          </select></label>
          <label>{movementKind === 'transfer' ? 'Lähtökassa' : 'Kassa'}<select value={movementBook} onChange={e => setMovementBook(e.target.value)}>
            <option value="">Valitse kassa</option>{tracker.wallets.map(w => <option key={w.bookmaker} value={w.bookmaker}>{w.bookmaker}</option>)}
          </select></label>
          {movementKind === 'transfer' && <label>Kohdekassa<select value={movementTarget} onChange={e => setMovementTarget(e.target.value)}>
            <option value="">Valitse kassa</option>{tracker.wallets.filter(w => w.bookmaker !== movementBook).map(w => <option key={w.bookmaker} value={w.bookmaker}>{w.bookmaker}</option>)}
          </select></label>}
          <label>{movementKind === 'reconcile' ? 'Uusi seurantasaldo €' : 'Summa €'}<input type="number" min={movementKind === 'reconcile' ? '0' : '.01'} max="100000000" step=".01" value={movementAmount} onChange={e => setMovementAmount(e.target.value)} /></label>
          <label>Perustelu<input maxLength="500" value={movementReason} onChange={e => setMovementReason(e.target.value)} placeholder="Esim. talletus, nosto tai saldon tarkistus" /></label>
          <button className="btn p" disabled={tracker.busy || !canRecordWalletMovement(tracker.wallets, {
            book: movementBook, kind: movementKind, target: movementTarget,
            amount: movementAmount, reason: movementReason,
          })}
            onClick={async () => {
              if (!window.confirm('Kirjataanko tämä virtuaalikassan muutos? Kirjaus jää historiaan eikä muuta aiempia vetoja.')) return;
              const success = await tracker.run(() => movementKind === 'transfer'
                ? transferArbWallet(movementBook, movementTarget, Number(movementAmount), movementReason)
                : adjustArbWallet(movementBook, movementKind, Number(movementAmount), movementReason));
              if (success) { setMovementAmount(''); setMovementReason(''); }
            }}>Kirjaa muutos</button>
        </div>
        <h3>Viimeisimmät kassakirjaukset</h3>
        <p>Enintään 50 uusinta kirjausta. Vedot ja käsin tehdyt muutokset näkyvät erillisinä.</p>
        {tracker.cashEntries.map(entry => <div className="arb-track-row arb-cash-entry" key={entry.id}>
          <span>{fmt(entry.created_at)}</span><b>{entry.bookmaker}</b>
          <span>{cashKindLabel[entry.kind] || entry.kind}</span>
          <span>{Number(entry.amount) > 0 ? '+' : ''}{money(entry.amount)}</span>
          {entry.balance_after != null && <span>Saldo {money(entry.balance_after)}</span>}
          {entry.note && <span>{entry.note}</span>}
        </div>)}
      </>}
    </div>
  );
  if (tab === 'analytics') return (
    <div className="card arb-track-panel">
      {actionMessage}
      <h2>Oma arbitraasianalytiikka</h2>
      <div className="arb-track-row"><span>Aloitettuja yrityksiä: {metrics.started}</span><span>Kaikki jalat asetettu: {metrics.fullyPlaced}</span><span>Osuus: {metrics.successPct == null ? 'ei aineistoa' : metrics.successPct.toFixed(1) + ' %'}</span></div>
      <div className="arb-track-row"><span>Aika aloituksesta viimeiseen jalkaan: {metrics.averageSeconds == null ? 'ei aineistoa' : Math.round(metrics.averageSeconds) + ' s keskimäärin'}</span><span>Ratkaistuja jalkoja: {metrics.settledLegs}</span><span>Toteutunut jalkojen PnL: {money(metrics.realizedPnl)}</span></div>
      <div className="arb-track-row"><span>Osittain asetettuja: {metrics.partialWithStake}</span><span>Suoraan hylättyjä: {metrics.rejectedWithoutTimer}</span><span>Kertoimen muutos tarjouksesta: {metrics.averageOddsChangePct == null ? 'ei aineistoa' : metrics.averageOddsChangePct.toFixed(2) + ' % / jalka'}</span></div>
      <p>Suoraan hylättyihin tarjouksiin ei kirjata yrittämisaikaa. Toteutunut PnL kattaa vain ratkaistut jalat; avoimia vetoja ei lasketa voitoksi.</p>
      {tracker.consent
        ? <div className="arb-track-row"><span>Yhteenvetoanalyysin suostumus on voimassa.</span>
          <button className="btn" disabled={tracker.busy} onClick={() => tracker.run(() => setArbAnalyticsConsent(false))}>Peru suostumus</button></div>
        : <label className="arb-track-row"><input type="checkbox" checked={false} disabled={tracker.busy}
          onChange={() => tracker.run(() => setArbAnalyticsConsent(true))} />
          Salli anonymisoidun datani käyttö Vedoxin sisäisessä perustajatiimin yhteenvetoanalyysissä. Oletus on pois päältä.</label>}
    </div>
  );
  return (
    <div className="arb-track-list">
      {actionMessage}
      {tracker.attempts.length === 0 && <div className="card arb-track-panel">Et ole vielä kirjannut arbitraasiyrityksiä.</div>}
      {tracker.attempts.map(a => {
        const snapshot = a.offer_snapshot || {};
        const ownLegs = tracker.legs.filter(l => l.attempt_id === a.id).sort((x, y) => x.ordinal - y.ordinal);
        const scenario = arbPlacedScenario(ownLegs);
        const replacement = offers.filter(o => o.eventId && o.eventId === snapshot.event_id &&
          o.market === (snapshot.markkina || snapshot.market) && String(o.line || '') === String(snapshot.line || '') &&
          arbOfferTermsChanged(snapshot, o));
        return <section className="card arb-track-panel" key={a.id}>
          <div className="arb-track-row"><h2>{snapshot.ottelu || 'Arbitraasiyritys'}</h2><span>{attemptStatusLabel[a.status] || a.status} · aloitettu {fmt(a.started_at)}</span></div>
          <p>Alkuperäinen tarjous: {Number(snapshot.profit_pct || 0).toFixed(2)} % · havaittu {fmt(a.source_updated_at)}. Tarjouksen tilanne voi muuttua; tarkista aina bookkerilta.</p>
          {a.previous_attempt_id && <p>Tämä on uusi yritys aiemman tarjouksen jälkeen. Aiemmat jalat säilyvät omassa yrityksessään.</p>}
          {ownLegs.map(l => <LegEditor key={l.id} leg={l} tracker={tracker} attemptStatus={a.status} />)}
          {scenario && <p>Teoreettinen minimitulos vahvistetuilla panoksilla ja kertoimilla: {money(scenario.theoreticalWorstPnl)}. Tämä edellyttää että lopputulokset kattavat markkinan ja bookkereiden selvityssäännöt ovat yhtenevät; se ei ole toteutunut voitto.</p>}
          {a.reason && <p>Syy: {a.reason}</p>}
          {['started', 'partial'].includes(a.status) && ownLegs.every(l => l.status !== 'placed') &&
            <button className="btn" disabled={tracker.busy} onClick={() => { const reason = window.prompt('Miksi keskeytit yrityksen?'); if (reason !== null) tracker.run(() => closeArbAttempt(a.id, reason)); }}>Keskeytä</button>}
          {replacement.length === 1 && <div>
            <p>Uusi tarjous samasta tapahtumasta ja markkinasta: {replacement[0].profit.toFixed(2)} %. Havaitut muutokset:</p>
            <ul>{describeArbOfferChange(snapshot, replacement[0]).map(change => <li key={change}>{change}</li>)}</ul>
            <button className="btn" disabled={tracker.busy} onClick={() => {
            if (window.confirm('Aloitetaanko uusi, erillinen yritys muuttuneesta tarjouksesta? Vanha yritys ja sen jalat säilyvät.'))
              tracker.run(() => createArbAttempt(replacement[0].id, replacement[0].sourceUpdatedAt, null, a.id));
            }}>Aloita erillinen uusi yritys</button>
          </div>}
          {replacement.length > 1 && <p>Samasta kohteesta löytyi useita uusia tarjouksia. Valitse uusi tarjous tarjouslistasta; automaattista vaihtoa ei tehdä.</p>}
        </section>;
      })}
    </div>
  );
}
