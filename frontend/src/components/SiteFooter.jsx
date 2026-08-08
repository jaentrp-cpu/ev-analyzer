import React from 'react';

export default function SiteFooter({ onPolicy }) {
  return (
    <footer className="site-footer">
      <span>© 2026 Vedox</span>
      <button onClick={() => onPolicy?.('terms')}>Käyttöehdot</button>
      <button onClick={() => onPolicy?.('privacy')}>Tietosuoja</button>
      <button onClick={() => onPolicy?.('responsible')}>Vastuullinen pelaaminen</button>
      <a href="mailto:support@vedox.fi">Tuki</a>
    </footer>
  );
}
