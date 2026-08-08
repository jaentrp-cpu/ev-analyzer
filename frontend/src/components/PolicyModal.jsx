import React from 'react';

const CONTENT = {
  terms: {
    title: 'Käyttöehdot',
    lead: 'Vedox ei ole vedonvälittäjä eikä ota vastaan panoksia. Palvelu näyttää dataan perustuvia kohteita, ja käyttäjä tekee aina itse päätöksen pelaamisesta.',
    sections: [
      ['Palvelun kuvaus', 'Vedox tarjoaa analytiikkaa, kohteiden vertailua ja pelikassan seurantaa. Palvelu ei ole sijoitus-, talous- tai vedonlyöntineuvontaa eikä takaa voittoja.'],
      ['Käyttäjän vastuu', 'Käyttäjä vastaa itse kaikista vedonlyöntipäätöksistään, panoksistaan ja siitä, että palvelua käytetään oman maan lainsäädännön mukaisesti.'],
      ['Maksulliset näkymät', 'Arvovedot, varmavedot, omat vedot ja analytiikka avautuvat vain sille Vedox-tasolle, jonka ylläpito on aktivoinut käyttäjälle. Tunnusten jakaminen tai maksullisten kohteiden levittäminen muille on kielletty.'],
      ['Yhteydenotot', 'Kysymykset käyttöehdoista: support@vedox.fi'],
    ],
  },
  privacy: {
    title: 'Tietosuojaseloste',
    lead: 'Vedox käsittelee vain palvelun toimittamiseen tarvittavia käyttäjätietoja.',
    sections: [
      ['Kerättävät tiedot', 'Palvelu voi käsitellä sähköpostiosoitetta, käyttäjänimeä, Vedox-tasoa, kassa- ja panosasetuksia sekä käyttäjän itse lisäämiä vetoja ja tuloksia.'],
      ['Tietojen käyttö', 'Tietoja käytetään kirjautumiseen, käyttöoikeuksien hallintaan, omien vetojen näyttämiseen ja käyttäjäasetusten tallentamiseen. Tietoja ei myydä ulkopuolisille.'],
      ['Tietojen säilytys', 'Tiedot säilytetään Supabase-palvelussa EU:n tietosuojasääntöjen mukaisesti. Osa asetuksista voi tallentua myös selaimen paikalliseen muistiin käyttökokemuksen parantamiseksi.'],
      ['Oikeudet', 'Voit pyytää tietojesi tarkistamista, korjaamista tai poistamista lähettämällä viestin osoitteeseen support@vedox.fi.'],
    ],
  },
  responsible: {
    title: 'Vastuullinen pelaaminen',
    lead: 'Vedonlyöntiin liittyy aina riski menettää panostettua rahaa. Pelaa vain summilla, joiden menettäminen ei vaaranna arkeasi.',
    sections: [
      ['Periaatteet', 'Päätä budjetti etukäteen, älä ylitä sitä, älä pelaa lainarahalla ja pidä kiinni valitusta panossuunnitelmasta.'],
      ['Varoitusmerkkejä', 'Jos pelaaminen vaikuttaa uneen, työhön, ihmissuhteisiin tai talouteen, pidä tauko ja hae apua.'],
      ['Apua ja tukea', 'Suomessa tukea tarjoaa esimerkiksi Peluuri. Vedox suosittelee käyttämään vedonlyöntisivustojen omia rajoitustyökaluja.'],
      ['Ikäraja', 'Vedox on tarkoitettu vain 18 vuotta täyttäneille. Alaikäisten rahapelaaminen on kielletty.'],
    ],
  },
};

export default function PolicyModal({ type, onClose }) {
  if (!type) return null;
  const content = CONTENT[type] || CONTENT.terms;
  return (
    <div
      className="modal-backdrop policy-backdrop"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="policy-modal card" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Sulje">×</button>
        <h2>{content.title}</h2>
        <div className="policy-lead">{content.lead}</div>
        {content.sections.map(([title, body]) => (
          <div className="policy-section" key={title}>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
        <small>Tämä on MVP-vaiheen seloste ja sitä päivitetään palvelun kehittyessä.</small>
      </section>
    </div>
  );
}
