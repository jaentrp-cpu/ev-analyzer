import React, { useEffect, useState } from 'react';
import { useVedox } from '../context/VedoxContext.jsx';
import { DEFAULT_PUBLIC_NEWS, fetchPublicContent } from '../publicContent.js';

const newsTag = {
  paivitys: 'Päivitys',
  tapahtuma: 'Tapahtuma',
  status: 'Status',
};

export default function Home({ setPage }) {
  const { setShowAuth } = useVedox();
  const [content, setContent] = useState({ news: DEFAULT_PUBLIC_NEWS });
  useEffect(() => {
    let alive = true;
    fetchPublicContent().then(next => { if (alive) setContent(next); });
    return () => { alive = false; };
  }, []);
  const news = (content.news || DEFAULT_PUBLIC_NEWS).slice(0, 5);
  const platformPreview = `${import.meta.env.BASE_URL || '/'}vedox-platform-preview.png`;

  return (
    <div className="home-landing">
      <section className="home-landing-hero card">
        <div className="home-kicker"><span />Vedox &middot; Logic Over Luck</div>
        <h1>
          Logiikalla, ei tuurilla -{' '}
          <span>Maksimoi etusi vedonly&ouml;nnist&auml;</span>
        </h1>
        <p>
          Vedox kokoaa arvo- ja varmavedot samaan n&auml;kym&auml;&auml;n, auttaa seuraamaan kassoja ja tekee
          omien vetojen tulosseurannasta selke&auml;mp&auml;&auml;. Tarkista kertoimet aina bookkerilta ennen pelaamista.
        </p>
        <div className="home-actions">
          <button className="btn p" onClick={() => setShowAuth(true)}>Luo tunnus</button>
          <button className="btn" onClick={() => setPage('guides')}>Lue lis&auml;&auml;</button>
        </div>
      </section>

      <div className="home-main-grid">
        <section className="home-info card">
          <div className="home-kicker small"><span />N&auml;in Vedox toimii</div>
          <h2>Arvovedot, varmavedot ja kassan seuranta yhdess&auml; paikassa</h2>
          <p>
            Vedox n&auml;ytt&auml;&auml; kohteet, niiden arvioidun edun, panoksen ja bookkerin. Kun merkitset vedon omiin vetoihin,
            sivu seuraa samalla bookkerikohtaisia saldoja ja tuloksia.
          </p>

          <div className="home-feature-grid">
            <button className="home-feature card" onClick={() => setPage('guides')}>
              <div className="tag">Arvovedot / Value bets</div>
              <h3>Positiivinen etu</h3>
              <p>
                Kohteita, joissa tarjolla oleva kerroin n&auml;ytt&auml;&auml; Vedoxin arvion mukaan kiinnostavalta.
                Filtterit auttavat rajaamaan lajin, liigan, bookkerin ja ajankohdan.
              </p>
              <span>Lue lis&auml;&auml; &#8594;</span>
            </button>

            <button className="home-feature card" onClick={() => setPage('guides')}>
              <div className="tag">Varmavedot / Sure bets</div>
              <h3>Lukittu tuotto</h3>
              <p>
                Tilanteita, joissa panos voidaan jakaa eri lopputuloksille niin, ett&auml; laskennallinen tuotto
                on mahdollinen riippumatta ottelun lopputuloksesta.
              </p>
              <span>Lue lis&auml;&auml; &#8594;</span>
            </button>
          </div>
        </section>

        <aside className="home-news card">
          <div className="home-news-head">
            <h2>Ajankohtaista</h2>
            <button onClick={() => setPage('news')}>Kaikki &#8594;</button>
          </div>
          <div className="home-news-list">
            {news.map((n, i) => (
              <button key={`${n.title}-${i}`} className="home-news-item" onClick={() => setPage('news')}>
                <div className={`home-news-tag ${n.tag || 'status'}`}><span />{newsTag[n.tag] || 'Status'}</div>
                <strong>{n.title}</strong>
                <small>{n.when}</small>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <section className="home-platform-preview" aria-label="Vedox sovellusnakyma">
        <img src={platformPreview} alt="Vedox arvovedot nakyma tietokoneella ja puhelimella" />
      </section>
    </div>
  );
}
