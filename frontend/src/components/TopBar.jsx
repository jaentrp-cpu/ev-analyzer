import React from 'react';
import { useVedox } from '../context/VedoxContext.jsx';

const TAB_LABELS = {
  home: 'Etusivu', value: 'Arvovedot', sure: 'Varmavedot',
  mybets: 'Omat vedot & analytiikka', guides: 'Ohjeet', news: 'Ajankohtaista',
  subscriptions: 'Tilaukset', socials: 'Socials',
};

export default function TopBar({ page }) {
  const { setShowAuth, session, signOut } = useVedox();
  return (
    <div className="topbar">
      <div className="crumb">
        <span>Työpöytä</span>
        <span className="s">/</span>
        <b>{TAB_LABELS[page] || page}</b>
      </div>
      <div className="right">
        {session
          ? <button className="btn ghost logout-top" title="Kirjaudu ulos" onClick={signOut}>
              Kirjaudu ulos
            </button>
          : <button className="btn ghost login-top" onClick={() => setShowAuth(true)}>
              Kirjaudu
            </button>
        }
      </div>
    </div>
  );
}
