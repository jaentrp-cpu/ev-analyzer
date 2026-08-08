import React from 'react';

const channels = [
  {
    name: 'Telegram',
    initial: 'TG',
    status: 'Yhteisö ja ilmoitukset',
    body: 'Vedox käyttää Telegramia uusien arvo- ja varmavetojen ilmoituksiin sekä yhteisön tiedottamiseen.',
    active: true,
  },
  {
    name: 'X / Twitter',
    initial: 'X',
    status: 'Tulossa',
    body: 'Lyhyet päivitykset, nostot ja Vedoxiin liittyvät julkaisut.',
  },
  {
    name: 'Instagram',
    initial: 'IG',
    status: 'Tulossa',
    body: 'Visuaaliset nostot, esimerkit ja palvelun kehityspäivitykset.',
  },
  {
    name: 'TikTok',
    initial: 'TT',
    status: 'Tulossa',
    body: 'Nopeat opastus- ja esimerkkivideot vedonlyöntidatan hyödyntämisestä.',
  },
];

export default function Socials() {
  return (
    <div className="page-body service-page">
      <div className="ph">
        <div>
          <h1>Socials</h1>
          <div className="sub">Vedoxin yhteisö, ilmoitukset ja tulevat somekanavat yhdessä paikassa.</div>
        </div>
      </div>

      <div className="social-grid">
        {channels.map(channel => (
          <section className="card social-card" key={channel.name}>
            <div className="social-mark">{channel.initial}</div>
            <div className="social-head">
              <h2>{channel.name}</h2>
              <span className={channel.active ? 'on' : ''}>{channel.status}</span>
            </div>
            <p>{channel.body}</p>
          </section>
        ))}
      </div>

      <section className="card social-support">
        <div>
          <h2>Tuki ja palaute</h2>
          <p>Kysymykset, kanavatoiveet ja yhteydenotot voi lähettää Vedoxin tukisähköpostiin.</p>
        </div>
        <a className="btn p" href="mailto:support@vedox.fi?subject=Vedox%20socials">Ota yhteyttä</a>
      </section>
    </div>
  );
}
