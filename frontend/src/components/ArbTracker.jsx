import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  loadArbTracker,
  createArbAttempt,
  closeArbAttempt,
  markArbLegUnavailable,
  recordArbLeg,
  setArbBankroll,
  setArbAttemptDeleted,
  setArbAnalyticsConsent,
} from "../arb-tracker.js";
import {
  arbAttemptMetrics,
  arbOfferTermsChanged,
  describeArbOfferChange,
} from "../arb-metrics.js";
import { arbBankroll, arbTiming } from "../arb-bankroll.js";
import { createArbTrackerRequestScope } from "../arb-tracker-request-scope.js";
import AnalyticsInfo from "./AnalyticsInfo.jsx";
const money = (n) =>
  Number(n || 0).toLocaleString("fi-FI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
const fmt = (date) =>
  date ? new Date(date).toLocaleString("fi-FI") : "Ei mitattu";
const labels = {
  started: "Aloitettu",
  partial: "Osittain asetettu",
  placed: "Odottaa tuloksia",
  rejected: "Hylätty",
  abandoned: "Keskeytetty",
  settled: "Ratkaistu",
  failed: "Ei toteutunut kokonaan",
  pending: "Asettamatta",
  unavailable: "Ei onnistunut",
};
const arbErrorMessage = (e) => {
  const code = String(e?.message || "");
  if (code.includes("insufficient_shared_balance"))
    return "Yhteisessä kassassa ei ole riittävästi vapaata rahaa.";
  if (code.includes("shared_bankroll_missing"))
    return "Aseta ensin yhteisen kassan alkusumma Kassa-osiossa.";
  if (code.includes("offer_"))
    return "Kohde muuttui tai poistui. Päivitä kohteet.";
  return "Kirjaus epäonnistui. Tarkista tiedot ja päivitä näkymä ennen uutta yritystä.";
};
export function useArbTracker(enabled, userId) {
  const scopeRef = useRef(null);
  if (!scopeRef.current)
    scopeRef.current = createArbTrackerRequestScope(enabled, userId);
  else scopeRef.current.update(enabled, userId);
  const emptyData = {
    attempts: [],
    legs: [],
    corrections: [],
    wallets: [],
    cashEntries: [],
    consent: false,
    bankroll: null,
  };
  const [data, setData] = useState({ ...emptyData, ownerId: null });
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    if (!enabled) return;
    const ticket = scopeRef.current.beginLoad();
    try {
      const loaded = await loadArbTracker();
      if (!scopeRef.current.ownsLoad(ticket)) return;
      setData({ ...loaded, ownerId: userId });
      setLoadError("");
    } catch {
      if (scopeRef.current.ownsLoad(ticket))
        setLoadError(
          "Arbitraasiseuranta ei ole vielä käytettävissä. Tarjouslista toimii edelleen.",
        );
    }
  }, [enabled, userId]);
  useEffect(() => {
    setBusy(false);
    setData({ ...emptyData, ownerId: userId });
    setLoadError("");
    setActionError("");
    void reload();
  }, [reload, userId]);
  async function run(action) {
    if (loadError) return false;
    const ticket = scopeRef.current.beginAction();
    if (!ticket) return false;
    setBusy(true);
    setActionError("");
    try {
      await action();
      if (!scopeRef.current.ownsAction(ticket)) return false;
      await reload();
      return true;
    } catch (e) {
      if (!scopeRef.current.ownsAction(ticket)) return false;
      await reload();
      if (scopeRef.current.ownsAction(ticket))
        setActionError(arbErrorMessage(e));
      return false;
    } finally {
      if (scopeRef.current.finishAction(ticket)) {
        setBusy(false);
      }
    }
  }
  return {
    ...(enabled && data.ownerId === userId ? data : emptyData),
    error: loadError,
    actionError,
    busy,
    reload,
    run,
  };
}

export function ArbSummary({ tracker }) {
  const s = arbBankroll(
    tracker.attempts,
    tracker.legs,
    tracker.bankroll?.opening_amount,
  );
  if (tracker.error) return null;
  return (
    <>
      <div className="arb-summary">
        {[
          [
            "Kokonaiskassa",
            tracker.bankroll ? money(s.total) : "Aseta alkukassa",
          ],
          ["Kertynyt nettovoitto", money(s.pnl)],
          ["Avoimissa vedoissa", money(s.committed)],
          ["Vapaana", tracker.bankroll ? money(s.available) : "—"],
        ].map(([label, value]) => (
          <div className="card arb-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {s.unverifiedReturns > 0 && (
        <p role="status" className="arb-warning">
          {s.unverifiedReturns} aiemman vedon palautusta ei ole vahvistettu
          nettomääräksi. Tarkista ne Muokkaa-toiminnolla. Siihen asti kassaluvut
          ja käyrä perustuvat vanhoihin kirjattuihin palautuksiin.
        </p>
      )}
    </>
  );
}
export function ProfitChart({ summary }) {
  const points = [{ pnl: 0 }, ...summary.curve];
  const low = Math.min(0, ...points.map((p) => p.pnl)),
    high = Math.max(0, ...points.map((p) => p.pnl));
  const y = (n) => 180 - ((n - low) / (high - low || 1)) * 150;
  const x = (i) => 55 + (i / Math.max(1, points.length - 1)) * 680;
  return (
    <section className="card arb-track-panel">
      <div className="arb-analytics-heading">
        <h2>Voittokäyrä</h2>
        <AnalyticsInfo label="Voittokäyrä">
          Ratkaistujen yritysten kertynyt nettotulos. Voitot nostavat ja tappiot
          laskevat käyrää. Alkukassa ja rahansiirrot eivät ole voittoa.
        </AnalyticsInfo>
      </div>
      {!summary.curve.length ? (
        <div className="arb-empty">
          Käyrä muodostuu, kun kirjaat ensimmäisen vedon tuloksen.
        </div>
      ) : (
        <>
          <svg
            className="arb-chart"
            viewBox="0 0 780 225"
            role="img"
            aria-label={`Kertynyt nettotulos ${money(summary.curve.at(-1)?.pnl || 0)}`}
          >
            <line
              x1="55"
              x2="735"
              y1={y(0)}
              y2={y(0)}
              stroke="currentColor"
              opacity=".25"
            />
            <text x="5" y="25" fill="currentColor">
              {money(high)}
            </text>
            <text x="5" y="200" fill="currentColor">
              {money(low)}
            </text>
            <polyline
              points={points.map((p, i) => `${x(i)},${y(p.pnl)}`).join(" ")}
              fill="none"
              stroke="var(--blue)"
              strokeWidth="3"
            />
            {summary.curve.map((p, i) => (
              <circle
                key={p.id}
                cx={x(i + 1)}
                cy={y(p.pnl)}
                r="4"
                fill="var(--blue)"
              >
                <title>
                  {fmt(p.at)}: {money(p.pnl)}
                </title>
              </circle>
            ))}
            <text x="55" y="220" fill="currentColor">
              Aloitus
            </text>
            <text x="735" y="220" textAnchor="end" fill="currentColor">
              Viimeisin tulos
            </text>
          </svg>
          <details>
            <summary>Näytä käyrän tapahtumat</summary>
            <table className="arb-table">
              <thead>
                <tr>
                  <th>Ratkaistu</th>
                  <th>Nettotulos</th>
                  <th>Kertynyt</th>
                </tr>
              </thead>
              <tbody>
                {summary.curve.map((p) => (
                  <tr key={p.id}>
                    <td>{fmt(p.at)}</td>
                    <td>{money(p.delta / 100)}</td>
                    <td>{money(p.pnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
      {summary.partialPnl !== 0 && (
        <div className="arb-analytics-heading arb-analytics-note">
          <span>Muut kirjatut tulokset: {money(summary.partialPnl)}</span>
          <AnalyticsInfo label="Muut kirjatut tulokset">
            Avoimien yritysten osatuloksia tai ilman ratkaisuhetkeä olevia
            tuloksia. Ne sisältyvät kassaan; käyrä näyttää kokonaan ratkaistut
            yritykset, joiden ratkaisuhetki tunnetaan.
          </AnalyticsInfo>
        </div>
      )}
      {summary.missingResultTimes > 0 && (
        <div className="arb-analytics-heading arb-analytics-note">
          <span>Ratkaisuhetki puuttuu: {summary.missingResultTimes}</span>
          <AnalyticsInfo label="Puuttuvat ratkaisuhetket">
            Nämä tulokset sisältyvät nettotulokseen, mutta eivät käyrään.
          </AnalyticsInfo>
        </div>
      )}
    </section>
  );
}
function LegRow({ leg, attempt, tracker }) {
  const [editing, setEditing] = useState(false);
  const [book, setBook] = useState(leg.actual_book || leg.offered_book);
  const [odds, setOdds] = useState(leg.actual_odds || leg.offered_odds);
  const [stake, setStake] = useState(leg.actual_stake || "");
  const [result, setResult] = useState(leg.result || "win");
  const [returned, setReturned] = useState(leg.returned_amount ?? "");
  const [reason, setReason] = useState("");
  useEffect(() => {
    setBook(leg.actual_book || leg.offered_book);
    setOdds(leg.actual_odds || leg.offered_odds);
    setStake(leg.actual_stake || "");
    setResult(leg.result || "win");
    setReturned(leg.returned_amount ?? "");
  }, [leg.effectiveCorrectionId, leg.status]);
  const timing = arbTiming(attempt, [leg])[0];
  const canPlace =
    leg.status === "pending" && ["started", "partial"].includes(attempt.status);
  const canEdit = ["placed", "settled"].includes(leg.status);
  const valid = book.trim() && Number(odds) > 1 && Number(stake) > 0;
  const validResult =
    returned !== "" &&
    Number(returned) >= 0 &&
    (result !== "lose" || Number(returned) === 0);
  const save = async () => {
    const values = { book, odds: Number(odds), stake: Number(stake), reason };
    if (leg.status === "settled")
      Object.assign(values, { result, returned: Number(returned) });
    if (
      await tracker.run(() =>
        recordArbLeg(leg.id, canPlace ? "place" : "edit", values),
      )
    ) {
      setEditing(false);
      setReason("");
    }
  };
  return (
    <React.Fragment>
      <tr>
        <td>
          <b>{leg.offered_outcome}</b>
          <small>
            Tarjous {leg.offered_book} @ {leg.offered_odds}
          </small>
        </td>
        <td>
          {canPlace || editing ? (
            <input
              aria-label="Kirja"
              value={book}
              onChange={(e) => setBook(e.target.value)}
            />
          ) : (
            leg.actual_book || leg.offered_book
          )}
        </td>
        <td>
          {canPlace || editing ? (
            <input
              aria-label="Todellinen kerroin"
              type="number"
              min="1.01"
              step=".01"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
            />
          ) : (
            leg.actual_odds || leg.offered_odds
          )}
        </td>
        <td>
          {canPlace || editing ? (
            <input
              aria-label="Todellinen panos euroina"
              type="number"
              min=".01"
              step=".01"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
            />
          ) : leg.actual_stake ? (
            money(leg.actual_stake)
          ) : (
            "—"
          )}
        </td>
        <td>
          {labels[leg.status]}
          {leg.status === "settled" && (
            <small>
              {{ win: "Voitto", lose: "Tappio", void: "Mitätöity" }[leg.result]}{" "}
              · {money(Number(leg.returned_amount) - Number(leg.actual_stake))}
            </small>
          )}
        </td>
        <td>
          {timing.attemptSeconds == null
            ? "—"
            : Math.round(timing.attemptSeconds) + " s"}
          <small>{fmt(leg.checked_at || leg.placed_at)}</small>
        </td>
        <td>
          {canPlace ? (
            <button
              className="btn p"
              disabled={tracker.busy || !valid}
              onClick={save}
            >
              Veto asetettu
            </button>
          ) : (
            canEdit && (
              <button
                className="btn"
                disabled={tracker.busy}
                onClick={() => setEditing(!editing)}
              >
                {editing ? "Peru muokkaus" : "Muokkaa"}
              </button>
            )
          )}
        </td>
      </tr>
      {(canPlace || editing || leg.status === "placed") && (
        <tr>
          <td colSpan="7">
            <div className="arb-track-row">
              {(editing || canPlace) && (
                <label>
                  {editing ? "Muutoksen syy" : "Jos veto ei onnistunut: syy"}
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Esimerkiksi kerroin muuttui"
                  />
                </label>
              )}
              {canPlace && (
                <button
                  className="btn"
                  disabled={tracker.busy || !reason.trim()}
                  onClick={() =>
                    tracker.run(() =>
                      markArbLegUnavailable(
                        leg.id,
                        reason,
                        Number(odds) > 1 ? Number(odds) : null,
                      ),
                    )
                  }
                >
                  Ei onnistunut
                </button>
              )}
              {((leg.status === "placed" && !editing) ||
                (leg.status === "settled" && editing)) && (
                <>
                  <label>
                    Tulos
                    <select
                      value={result}
                      onChange={(e) => {
                        setResult(e.target.value);
                        setReturned(
                          e.target.value === "lose"
                            ? 0
                            : e.target.value === "void"
                              ? stake
                              : "",
                        );
                      }}
                    >
                      <option value="win">Voitto</option>
                      <option value="lose">Tappio</option>
                      <option value="void">Mitätöity</option>
                    </select>
                  </label>
                  <label>
                    Todellinen palautus €
                    <input
                      type="number"
                      min="0"
                      step=".01"
                      value={returned}
                      onChange={(e) => setReturned(e.target.value)}
                    />
                  </label>
                  <span>
                    Kirjaa maksettu palautus komission ja kulujen jälkeen.
                  </span>
                  {!editing && (
                    <button
                      className="btn p"
                      disabled={tracker.busy || !validResult}
                      onClick={() =>
                        tracker.run(() =>
                          recordArbLeg(leg.id, "settle", {
                            result,
                            returned: Number(returned),
                          }),
                        )
                      }
                    >
                      Kirjaa tulos
                    </button>
                  )}
                </>
              )}
              {editing && (
                <button
                  className="btn p"
                  disabled={
                    tracker.busy ||
                    !valid ||
                    !reason.trim() ||
                    (leg.status === "settled" && !validResult)
                  }
                  onClick={save}
                >
                  Tallenna muutos
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
      {leg.failure_reason && (
        <tr>
          <td colSpan="7">Ei onnistunut: {leg.failure_reason}</td>
        </tr>
      )}
    </React.Fragment>
  );
}
export default function ArbTracker({ tracker, offers, tab, compact = false }) {
  const [opening, setOpening] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [expanded, setExpanded] = useState(null);
  useEffect(() => {
    setOpening(tracker.bankroll?.opening_amount ?? "");
    setExpanded(null);
    setShowDeleted(false);
  }, [tracker.ownerId, tracker.bankroll?.opening_amount]);
  const active = tracker.attempts.filter((a) => !a.deleted_at);
  const legs = tracker.legs.filter((l) =>
    active.some((a) => a.id === l.attempt_id),
  );
  const metrics = arbAttemptMetrics(active, legs);
  const summary = arbBankroll(
    tracker.attempts,
    tracker.legs,
    tracker.bankroll?.opening_amount,
  );
  if (tracker.error)
    return (
      <div className="card arb-track-panel" role="status">
        {tracker.error}
        <button className="btn" onClick={tracker.reload}>
          Yritä uudelleen
        </button>
      </div>
    );
  const error = tracker.actionError && (
    <div role="alert">{tracker.actionError}</div>
  );
  if (tab === "wallets")
    return (
      <section className="card arb-track-panel">
        {error}
        <h2>Yhteinen arbitraasikassa</h2>
        <p>
          Yksi alkukassa kaikille yrityksille. Rahansiirto pankkitilin ja
          kirjojen välillä ei muuta tätä kassaa.
        </p>
        <div className="arb-track-row">
          <label>
            Alkukassa €
            <input
              type="number"
              min="0"
              step=".01"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
            />
          </label>
          <button
            className="btn p"
            disabled={tracker.busy || opening === "" || Number(opening) < 0}
            onClick={() => tracker.run(() => setArbBankroll(Number(opening)))}
          >
            Tallenna alkukassa
          </button>
        </div>
        <p>
          Alkukassa + toteutunut nettotulos = kokonaiskassa. Alkukassan
          korjaaminen ei muuta nettovoittokäyrää.
        </p>
        {summary.available < 0 && (
          <p role="alert">
            Vapaana oleva saldo on negatiivinen. Tarkista alkukassa ja
            kirjaukset.
          </p>
        )}
      </section>
    );
  if (tab === "analytics")
    return (
      <>
        {error}
        <ProfitChart summary={summary} />
        <section className="card arb-track-panel">
          <h2>Yritysten onnistuminen</h2>
          <div className="arb-summary">
            {[
              ["Aloitettuja", metrics.started],
              ["Kaikki vedot asetettu", metrics.fullyPlaced],
              [
                "Onnistumisosuus",
                metrics.successPct == null
                  ? "—"
                  : metrics.successPct.toFixed(1) + " %",
              ],
              [
                "Keskimääräinen kirjausaika",
                metrics.averageSeconds == null
                  ? "—"
                  : Math.round(metrics.averageSeconds) + " s",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="arb-analytics-heading">
            <h3>Kirjakohtainen havaittu viive</h3>
            <AnalyticsInfo label="Kirjakohtainen havaittu viive">
              Aika tarjouksen päivityksestä vedon vahvistamiseen. Tämä on
              kirjaushavainto, ei automaattisesti mitattu kertoimen koko
              voimassaoloaika.
            </AnalyticsInfo>
          </div>
          <div className="arb-table-wrap">
            <table className="arb-table">
              <thead>
                <tr>
                  <th>Kirja</th>
                  <th>Havaintoja</th>
                  <th>Sama kerroin</th>
                  <th>Keskim. viive</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...new Set(
                    legs
                      .filter((l) => l.checked_at || l.placed_at)
                      .map((l) => l.actual_book || l.offered_book),
                  ),
                ].map((book) => {
                  const rows = active
                    .flatMap((a) =>
                      arbTiming(
                        a,
                        legs.filter((l) => l.attempt_id === a.id),
                      ),
                    )
                    .filter(
                      (l) =>
                        (l.actual_book || l.offered_book) === book &&
                        l.observationSeconds != null,
                    );
                  return (
                    <tr key={book}>
                      <td>{book}</td>
                      <td>{rows.length}</td>
                      <td>{rows.filter((l) => l.sameOdds).length}</td>
                      <td>
                        {rows.length
                          ? Math.round(
                              rows.reduce(
                                (s, l) => s + l.observationSeconds,
                                0,
                              ) / rows.length,
                            ) + " s"
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Yhteenvetoanalyysin suostumus</summary>
            <label>
              <input
                type="checkbox"
                checked={tracker.consent}
                disabled={tracker.busy}
                onChange={(e) =>
                  tracker.run(() => setArbAnalyticsConsent(e.target.checked))
                }
              />{" "}
              Salli anonymisoitu perustajatiimin yhteenvetoanalyysi
            </label>
          </details>
        </section>
      </>
    );
  const visible = tracker.attempts.filter((a) =>
    showDeleted ? Boolean(a.deleted_at) : !a.deleted_at,
  );
  const rows = compact
    ? visible.filter((a) => ["started", "partial", "placed"].includes(a.status))
    : visible;
  return (
    <section className="card arb-track-panel">
      {error}
      <div className="arb-track-row">
        <h2>{compact ? "Keskeneräiset yritykset" : "Omat yritykset"}</h2>
        {!compact && (
          <button
            className="btn"
            onClick={() => {
              setShowDeleted(!showDeleted);
              setExpanded(null);
            }}
          >
            {showDeleted ? "Takaisin historiaan" : "Poistetut yritykset"}
          </button>
        )}
      </div>
      {!rows.length ? (
        <p>Ei yrityksiä tässä näkymässä.</p>
      ) : (
        <div className="arb-table-wrap">
          <table className="arb-table">
            <thead>
              <tr>
                <th>Ottelu / markkina</th>
                <th>Aloitettu</th>
                <th>Tila</th>
                <th>Asetettu</th>
                <th>Nettotulos</th>
                <th>Toiminnot</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const own = tracker.legs
                  .filter((l) => l.attempt_id === a.id)
                  .sort((x, y) => x.ordinal - y.ordinal);
                const replacement = offers.filter(
                  (o) =>
                    o.eventId &&
                    o.eventId === a.offer_snapshot?.event_id &&
                    o.market ===
                      (a.offer_snapshot?.markkina ||
                        a.offer_snapshot?.market) &&
                    String(o.line || "") ===
                      String(a.offer_snapshot?.line || "") &&
                    arbOfferTermsChanged(a.offer_snapshot, o),
                );
                const pnl = own
                  .filter((l) => l.status === "settled")
                  .reduce(
                    (sum, l) =>
                      sum + Number(l.returned_amount) - Number(l.actual_stake),
                    0,
                  );
                return (
                  <React.Fragment key={a.id}>
                    <tr>
                      <td>
                        <b>{a.offer_snapshot?.ottelu || "Yritys"}</b>
                        <small>
                          {a.offer_snapshot?.markkina} · tarjous{" "}
                          {Number(a.offer_snapshot?.profit_pct || 0).toFixed(2)}{" "}
                          %
                        </small>
                      </td>
                      <td>{fmt(a.started_at)}</td>
                      <td>{a.deleted_at ? "Poistettu" : labels[a.status]}</td>
                      <td>
                        {
                          own.filter((l) =>
                            ["placed", "settled"].includes(l.status),
                          ).length
                        }
                        /{own.length}
                      </td>
                      <td>
                        {own.some((l) => l.status === "settled")
                          ? money(pnl)
                          : "—"}
                      </td>
                      <td>
                        <div className="arb-track-row">
                          <button
                            className="btn"
                            onClick={() =>
                              setExpanded(expanded === a.id ? null : a.id)
                            }
                          >
                            {expanded === a.id ? "Sulje" : "Avaa"}
                          </button>
                          <button
                            className="btn"
                            disabled={tracker.busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  a.deleted_at
                                    ? "Palautetaanko yritys historiaan ja kassalaskentaan?"
                                    : "Poistetaanko yritys historiasta ja laskelmista? Tämä ei peru oikeaa vetoa. Tallenne on palautettavissa.",
                                )
                              )
                                tracker.run(() =>
                                  setArbAttemptDeleted(a.id, !a.deleted_at),
                                );
                            }}
                          >
                            {a.deleted_at ? "Palauta" : "Poista"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded === a.id && (
                      <tr>
                        <td colSpan="6">
                          <p>
                            Tarjous havaittu {fmt(a.source_updated_at)}.
                            Ajanotto alkaa yrityksen aloituksesta. Kirjaa
                            jokainen veto erikseen.
                          </p>
                          <table className="arb-table">
                            <thead>
                              <tr>
                                <th>Valinta</th>
                                <th>Kirja</th>
                                <th>Kerroin</th>
                                <th>Panos</th>
                                <th>Tila / tulos</th>
                                <th>Aloituksesta</th>
                                <th>Kirjaus</th>
                              </tr>
                            </thead>
                            <tbody>
                              {own.map((l) =>
                                a.deleted_at ? (
                                  <tr key={l.id}>
                                    <td>{l.offered_outcome}</td>
                                    <td>{l.actual_book || l.offered_book}</td>
                                    <td>{l.actual_odds || l.offered_odds}</td>
                                    <td>{money(l.actual_stake)}</td>
                                    <td>{labels[l.status]}</td>
                                    <td>{fmt(l.placed_at)}</td>
                                    <td>Palauta yritys muokataksesi</td>
                                  </tr>
                                ) : (
                                  <LegRow
                                    key={l.id}
                                    leg={l}
                                    attempt={a}
                                    tracker={tracker}
                                  />
                                ),
                              )}
                            </tbody>
                          </table>
                          {!a.deleted_at &&
                            ["started", "partial"].includes(a.status) &&
                            own.every((l) => l.status !== "placed") && (
                              <button
                                className="btn"
                                disabled={tracker.busy}
                                onClick={() => {
                                  const reason =
                                    window.prompt("Keskeytyksen syy");
                                  if (reason !== null)
                                    tracker.run(() =>
                                      closeArbAttempt(a.id, reason),
                                    );
                                }}
                              >
                                Keskeytä yritys
                              </button>
                            )}
                          {!a.deleted_at && replacement.length === 1 && (
                            <details>
                              <summary>Kohteen ehdot ovat muuttuneet</summary>
                              {describeArbOfferChange(
                                a.offer_snapshot,
                                replacement[0],
                              ).map((text, i) => (
                                <p key={i}>{text}</p>
                              ))}
                              <button
                                className="btn"
                                disabled={tracker.busy}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Aloitetaanko muuttuneesta kohteesta uusi erillinen yritys?",
                                    )
                                  )
                                    tracker.run(() =>
                                      createArbAttempt(
                                        replacement[0].id,
                                        replacement[0].sourceUpdatedAt,
                                        null,
                                        a.id,
                                      ),
                                    );
                                }}
                              >
                                Aloita uusi yritys
                              </button>
                            </details>
                          )}
                          <p>
                            Laskennallinen tuotto edellyttää yhteensopivia
                            markkinoita ja selvityssääntöjä. Se ei ole
                            toteutunut voitto.
                          </p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
