import React, { useEffect, useState } from "react";
import { useVedox } from "../context/VedoxContext.jsx";
import { Icon } from "../components/Icon.jsx";
import DatePicker from "../components/DatePicker.jsx";
import LockedView from "../components/LockedView.jsx";
import LoadingView from "../components/LoadingView.jsx";
import ArbTracker, {
  ArbSummary,
  useArbTracker,
} from "../components/ArbTracker.jsx";
import { createArbAttempt } from "../arb-tracker.js";

const EURO = "\u20ac";

function startsInDateRange(startsAt, timeFilter, from, to) {
  if (timeFilter === "all" || !startsAt) return true;
  const starts = new Date(startsAt).getTime();
  if (!Number.isFinite(starts)) return true;
  const now = Date.now();
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const todayEnd = todayStart + 864e5 - 1;
  if (timeFilter === "today") return starts >= todayStart && starts <= todayEnd;
  const hours = (starts - now) / 36e5;
  if (timeFilter === "24h") return hours >= 0 && hours <= 24;
  if (timeFilter === "3d") return hours >= 0 && hours <= 72;
  if (timeFilter === "7d") return hours >= 0 && hours <= 168;
  if (timeFilter === "custom") {
    const fromOk = from
      ? starts >= new Date(`${from}T00:00:00`).getTime()
      : true;
    const toOk = to ? starts <= new Date(`${to}T23:59:59`).getTime() : true;
    return fromOk && toOk;
  }
  return true;
}

export default function Sure() {
  const {
    arbitrages,
    stats,
    refreshEvBets,
    loading,
    session,
    authReady,
    permissionsReady,
    setShowAuth,
    canAccess,
  } = useVedox();
  const [stakes, setStakes] = useState({});
  const [leagueFilter, setLeagueFilter] = useState("Kaikki");
  const [bookFilter, setBookFilter] = useState("Kaikki");
  const [minProfit, setMinProfit] = useState("0");
  const [legsFilter, setLegsFilter] = useState("Kaikki");
  const [timeFilter, setTimeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tab, setTab] = useState("offers");
  const [freshnessNow, setFreshnessNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setFreshnessNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const tracker = useArbTracker(
    Boolean(session && permissionsReady && canAccess("sure")),
    session?.user?.id,
  );

  if (!authReady || (session && !permissionsReady && arbitrages.length === 0)) {
    return <LoadingView title="Varmavedot" />;
  }

  if (!session || !canAccess("sure")) {
    return (
      <LockedView pageId="sure" session={session} setShowAuth={setShowAuth} />
    );
  }

  const leagues = [
    "Kaikki",
    ...Array.from(
      new Set(arbitrages.map((a) => a.league).filter(Boolean)),
    ).sort(),
  ];
  const books = [
    "Kaikki",
    ...Array.from(
      new Set(
        arbitrages.flatMap((a) => a.legs.map((l) => l.book)).filter(Boolean),
      ),
    ).sort(),
  ];
  const filteredArbs = arbitrages.filter(
    (a) =>
      (leagueFilter === "Kaikki" || a.league === leagueFilter) &&
      (bookFilter === "Kaikki" || a.legs.some((l) => l.book === bookFilter)) &&
      a.profit >= Number(minProfit || 0) &&
      (legsFilter === "Kaikki" || a.legs.length === Number(legsFilter)) &&
      startsInDateRange(a.startsAt, timeFilter, dateFrom, dateTo),
  );

  return (
    <div className="page-body">
      <div className="ph">
        <div>
          <h1>Varmavedot</h1>
          <div className="sub">
            {filteredArbs.length} mahdollista varmavetoa juuri nyt &middot;
            panos jaetaan eri kirjoille
          </div>
        </div>
        <div className="actions">
          <button
            className="btn p refresh-btn"
            onClick={refreshEvBets}
            disabled={loading}
          >
            {loading ? "P\u00e4ivitet\u00e4\u00e4n..." : "P\u00e4ivit\u00e4"}
          </button>
        </div>
      </div>

      <ArbSummary tracker={tracker} />
      <nav className="arb-track-tabs" aria-label="Varmavetojen osiot">
        {[
          ["offers", "Kohteet"],
          ["attempts", "Omat yritykset"],
          ["wallets", "Kassa"],
          ["analytics", "Analytiikka"],
        ].map(([id, label]) => (
          <button
            className={"btn" + (tab === id ? " p" : "")}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "offers" && tracker.error && (
        <div className="card arb-track-panel" role="status">
          {tracker.error}{" "}
          <button className="btn" onClick={tracker.reload}>
            Yritä uudelleen
          </button>
        </div>
      )}
      {tab === "offers" && tracker.actionError && (
        <div className="card arb-track-panel" role="alert">
          Kirjaus epäonnistui: {tracker.actionError}
        </div>
      )}
      {tab !== "offers" && (
        <ArbTracker tracker={tracker} offers={arbitrages} tab={tab} />
      )}
      {tab === "offers" && (
        <>
          <ArbTracker
            tracker={tracker}
            offers={arbitrages}
            tab="attempts"
            compact
          />

          <div
            className="card"
            style={{
              padding: "14px 18px",
              display: "flex",
              gap: 14,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--blue-soft)",
                color: "var(--blue)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="sure" size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                Tarkista kertoimet aina bookkerilta ennen pelaamista
              </div>
              <div style={{ fontSize: 12, color: "var(--tx3)", marginTop: 2 }}>
                Tuotto on laskennallinen. Tarkista kertoimet, markkinan peliaika
                ja kirjojen selvityssäännöt. P&auml;ivitetty {stats.paivitetty}.
              </div>
            </div>
          </div>

          <div className="filters">
            <label className="filter-field">
              <span>Liiga</span>
              <select
                value={leagueFilter}
                onChange={(e) => setLeagueFilter(e.target.value)}
              >
                {leagues.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>Bookkeri</span>
              <select
                value={bookFilter}
                onChange={(e) => setBookFilter(e.target.value)}
              >
                {books.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field narrow">
              <span>Min. tuotto</span>
              <select
                value={minProfit}
                onChange={(e) => setMinProfit(e.target.value)}
              >
                <option value="0">0 %</option>
                <option value="1.5">1.5 %</option>
                <option value="2">2 %</option>
                <option value="3">3 %</option>
              </select>
            </label>
            <label className="filter-field narrow">
              <span>Jako</span>
              <select
                value={legsFilter}
                onChange={(e) => setLegsFilter(e.target.value)}
              >
                <option value="Kaikki">Kaikki</option>
                <option value="2">2 kirjaa</option>
                <option value="3">3 kirjaa</option>
              </select>
            </label>
            <label className="filter-field narrow">
              <span>Aika</span>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
              >
                <option value="all">Kaikki</option>
                <option value="today">T&auml;n&auml;&auml;n</option>
                <option value="24h">24 h</option>
                <option value="3d">3 vrk</option>
                <option value="7d">7 vrk</option>
                <option value="custom">
                  P&auml;iv&auml;m&auml;&auml;r&auml;
                </option>
              </select>
            </label>
            {timeFilter === "custom" && (
              <>
                <label className="filter-field date">
                  <span>Alkaen</span>
                  <DatePicker value={dateFrom} onChange={setDateFrom} />
                </label>
                <label className="filter-field date">
                  <span>Asti</span>
                  <DatePicker value={dateTo} onChange={setDateTo} />
                </label>
              </>
            )}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: "var(--tx3)" }}>
              {filteredArbs.length} / {arbitrages.length}{" "}
              n&auml;ytet&auml;&auml;n
            </span>
          </div>

          {filteredArbs.length === 0 && !loading && (
            <div
              className="card"
              style={{
                padding: "3rem",
                textAlign: "center",
                color: "var(--text3)",
              }}
            >
              Ei varmavetoja t&auml;ll&auml; hetkell&auml;. Vedox tarkistaa
              jatkuvasti uusia kohteita.
            </div>
          )}

          {filteredArbs.length > 0 && (
            <div className="card arb-table-wrap">
              <table className="arb-table">
                <thead>
                  <tr>
                    <th>Ottelu / markkina</th>
                    <th>Vedot ja kertoimet</th>
                    <th>Kokonaispanos €</th>
                    <th>Laskennallinen tuotto</th>
                    <th>Toiminnot</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArbs.map((s) => {
                    const seenMs = Date.parse(s.sourceUpdatedAt || "");
                    const staleOffer =
                      !Number.isFinite(seenMs) ||
                      freshnessNow - seenMs > 5 * 60_000;
                    const stake = stakes[s.id] ?? 200;
                    const impliedSum = s.legs.reduce(
                      (sum, l) => sum + (l.odds > 0 ? 1 / l.odds : 0),
                      0,
                    );
                    return (
                      <tr key={s.id}>
                        <td>
                          <b>{s.match}</b>
                          <small>
                            {s.league} · {s.market}
                          </small>
                          <small>
                            {s.startsAt
                              ? new Date(s.startsAt).toLocaleString("fi-FI")
                              : ""}
                          </small>
                          <small>
                            {staleOffer ? "Vanha havainto · " : ""}Päivitetty{" "}
                            {s.sourceUpdatedAt
                              ? new Date(s.sourceUpdatedAt).toLocaleTimeString(
                                  "fi-FI",
                                )
                              : "Ei mitattu"}
                          </small>
                        </td>
                        <td>
                          {s.legs.map((l, i) => {
                            const share =
                              l.share > 0
                                ? l.share
                                : impliedSum > 0
                                  ? (1 / l.odds / impliedSum) * 100
                                  : 0;
                            return (
                              <div className="arb-offer-leg" key={i}>
                                <b>{l.outcome}</b> · {l.book} @{" "}
                                {l.odds.toFixed(2)}
                                <small>
                                  Panos {Math.round((stake * share) / 100)} € ·{" "}
                                  {share.toFixed(1)} %
                                </small>
                              </div>
                            );
                          })}
                        </td>
                        <td>
                          <input
                            aria-label={`Kokonaispanos: ${s.match}`}
                            type="number"
                            min="1"
                            value={stake}
                            onChange={(e) =>
                              setStakes((prev) => ({
                                ...prev,
                                [s.id]: Number(e.target.value) || 0,
                              }))
                            }
                          />
                        </td>
                        <td>
                          <strong>{s.profit.toFixed(2)} %</strong>
                          <small>
                            {((stake * s.profit) / 100).toFixed(2)} €
                          </small>
                        </td>
                        <td>
                          <div className="arb-track-row">
                            <button
                              className="btn p"
                              disabled={tracker.busy || Boolean(tracker.error)}
                              onClick={async () => {
                                if (
                                  staleOffer &&
                                  !window.confirm(
                                    "Havainto on yli 5 minuuttia vanha tai ilman aikaleimaa. Vahvista kertoimet kirjoilta ennen aloitusta. Jatketaanko?",
                                  )
                                )
                                  return;
                                if (
                                  await tracker.run(() =>
                                    createArbAttempt(s.id, s.sourceUpdatedAt),
                                  )
                                )
                                  setTab("attempts");
                              }}
                            >
                              Aloita yritys
                            </button>
                            <button
                              className="btn"
                              disabled={tracker.busy || Boolean(tracker.error)}
                              onClick={() => {
                                const reason = window.prompt(
                                  "Miksi hylkäsit kohteen?",
                                );
                                if (reason?.trim())
                                  tracker.run(() =>
                                    createArbAttempt(
                                      s.id,
                                      s.sourceUpdatedAt,
                                      reason,
                                    ),
                                  );
                              }}
                            >
                              Hylkää
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
