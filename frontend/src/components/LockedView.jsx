import React from 'react';
import { Icon } from './Icon.jsx';

const pageNames = {
  value: 'Arvovedot',
  sure: 'Varmavedot',
  mybets: 'Omat vedot & analytiikka',
  analytics: 'Omat vedot & analytiikka',
};

const pageHints = {
  value: 'Arvovedot kuuluvat All-Star-pakettiin.',
  sure: 'Varmavedot kuuluvat All-Star-pakettiin.',
  mybets: 'Omat vedot & analytiikka kuuluu All-Star-pakettiin.',
  analytics: 'Omat vedot & analytiikka kuuluu All-Star-pakettiin.',
};

export default function LockedView({ pageId, session, setShowAuth }) {
  const title = pageNames[pageId] || 'Tämä näkymä';
  return (
    <div className="page-body">
      <div className="ph">
        <div>
          <h1>{title}</h1>
          <div className="sub">{session ? 'Näkymä ei kuulu nykyiseen Vedox-tasoosi' : 'Kirjaudu sisään nähdäksesi tämän näkymän'}</div>
        </div>
      </div>
      <section className="card locked-card">
        <div className="locked-icon"><Icon name="lock" size={18} /></div>
        <h2>{session ? 'Tämä ei kuulu Vedox-tasoosi' : 'Kirjaudu tai luo tunnus'}</h2>
        <p>
          {session
            ? pageHints[pageId] || 'Nykyinen käyttäjätasosi ei sisällä tätä näkymää.'
            : 'Luo tunnus tai kirjaudu sisään. Maksulliset näkymät avautuvat vasta, kun ylläpito on aktivoinut oikean tason käyttäjällesi.'}
        </p>
        {!session ? (
          <button className="btn p" onClick={() => setShowAuth(true)}>Kirjaudu tai luo tunnus</button>
        ) : (
          <a className="btn p" href="mailto:support@vedox.fi?subject=Vedox%20tilaus%3A%20All-Star">Kysy All-Starista</a>
        )}
      </section>
    </div>
  );
}
