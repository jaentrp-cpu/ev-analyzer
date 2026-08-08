import React from 'react';

export default function LoadingView({ title = 'Vedox' }) {
  return (
    <div className="page-body silent-loading" aria-busy="true" aria-live="polite">
      <div className="loading-panel">
        <div className="loading-dot" />
        <div>
          <div className="loading-title">{title}</div>
          <div className="loading-sub">Päivitetään näkymää...</div>
        </div>
      </div>
    </div>
  );
}
