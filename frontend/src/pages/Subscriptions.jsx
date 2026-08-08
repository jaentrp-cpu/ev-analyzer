import React from 'react';

const packages = [
  {
    name: 'All-Star',
    price: '49,99 €/kk',
    tag: 'Täysi käyttö',
    body: 'Yksi paketti sisältää koko Vedoxin ja kaikki nykyiset käyttäjäominaisuudet.',
    items: ['Arvovedot', 'Varmavedot', 'Omat vedot & analytiikka', 'Kelly- ja kiinteän panostuksen asetukset'],
  },
];

export default function Subscriptions() {
  return (
    <div className="page-body service-page">
      <div className="ph">
        <div>
          <h1>Tilaukset</h1>
          <div className="sub">All-Star sisältää arvovedot, varmavedot sekä omien vetojen seurannan ja analytiikan.</div>
        </div>
      </div>

      <div className="service-section-title">Kuukausipaketti</div>
      <div className="subscription-grid">
        {packages.map(pkg => (
          <section className="card subscription-card" key={pkg.name}>
            <div className="subscription-tag">{pkg.tag}</div>
            <div className="subscription-head">
              <h2>{pkg.name}</h2>
              <strong>{pkg.price}</strong>
            </div>
            <p>{pkg.body}</p>
            <ul>
              {pkg.items.map(item => <li key={item}>{item}</li>)}
            </ul>
            <a
              className="btn p subscription-cta"
              href={`mailto:support@vedox.fi?subject=${encodeURIComponent(`Vedox tilaus: ${pkg.name}`)}`}
            >
              Ota yhteyttä
            </a>
          </section>
        ))}
      </div>
    </div>
  );
}
