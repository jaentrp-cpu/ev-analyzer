import React, { useEffect, useState } from 'react';
import {
  DEFAULT_PUBLIC_EVENTS,
  DEFAULT_PUBLIC_NEWS,
  fetchPublicContent,
  preparePublicEvents,
} from '../publicContent.js';

const tagLabels = {
  paivitys: 'Päivitys',
  tapahtuma: 'Tapahtuma',
  status: 'Status',
};

const monthLabels = ['TAMMI', 'HELMI', 'MAALIS', 'HUHTI', 'TOUKO', 'KESÄ', 'HEINÄ', 'ELO', 'SYYS', 'LOKA', 'MARRAS', 'JOULU'];

export default function News() {
  const [content, setContent] = useState({ news: DEFAULT_PUBLIC_NEWS, events: DEFAULT_PUBLIC_EVENTS });
  useEffect(() => {
    let alive = true;
    fetchPublicContent().then(next => { if (alive) setContent(next); });
    return () => { alive = false; };
  }, []);
  const news = content.news || DEFAULT_PUBLIC_NEWS;
  const events = preparePublicEvents(content.events || DEFAULT_PUBLIC_EVENTS);

  return (
    <div className="page-body">
      <div className="ph">
        <div>
          <h1>Ajankohtaista</h1>
          <div className="sub">Vedoxin valikoimaan rajattu urheilukalenteri · vain vahvistetut alkamisajat</div>
        </div>
      </div>

      <div className="news-grid">
        <div className="card news-time">
          {news.map((n, i) => (
            <div className={'it ' + (n.tag === 'tapahtuma' ? 'tap' : n.tag === 'status' ? 'st' : '')} key={n.id || i}>
              <div>
                <div className="tag"><span className="dot" />{tagLabels[n.tag] || n.tag || 'Status'}</div>
                <div className="when">{n.when}</div>
              </div>
              <div>
                <div className="t">{n.title}</div>
                <div className="b">{n.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card events">
            <h3>Urheilukalenteri</h3>
            {events.length === 0 && (
              <div className="portfolio-empty">Kalenterissa ei ole tällä hetkellä näkyviä tapahtumia.</div>
            )}
            {events.map((event, i) => (
              <div className="ev" key={event.id || i}>
                <div className="dd">
                  {String(event.startsAt.getDate()).padStart(2, '0')}
                  <span className="mm">{monthLabels[event.startsAt.getMonth()]}</span>
                </div>
                <div className="m">
                  <div className="t">{event.title}</div>
                  <div className="s">
                    {event.summary}
                    {Array.isArray(event.sources) && event.sources.length > 0 && (
                      <>
                        {' · '}
                        {event.sources.map((source, sourceIndex) => (
                          <React.Fragment key={source.url || source.label}>
                            {sourceIndex > 0 ? ', ' : ''}
                            <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
                          </React.Fragment>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                <div className="ct">{event.status}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '18px 22px', background: 'linear-gradient(180deg, var(--bg2), var(--bg3))' }}>
            <div style={{ fontSize: 11, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 600 }}>/ Palaute</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.02em', marginTop: 8 }}>Kerro heti, jos jokin ei toimi</h3>
            <p style={{ color: 'var(--tx2)', fontSize: 13, marginTop: 8, lineHeight: 1.55 }}>
              Jos huomaat väärän kertoimen, puuttuvan tuloksen, rikkinäisen näkymän tai sinulla on kehitysidea,
              lähetä palaute suoraan Vedoxin tukisähköpostiin.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <a className="btn p" href="mailto:support@vedox.fi?subject=Palautetta%20Vedoxista" style={{ textDecoration: 'none' }}>Anna palautetta</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
