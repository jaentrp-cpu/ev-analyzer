import React from 'react';

export default function AnalyticsInfo({ label, children }) {
  return (
    <details className="analytics-info">
      <summary aria-label={`${label}: lisätiedot`} title={`${label}: lisätiedot`}>
        <span aria-hidden="true">i</span>
      </summary>
      <div className="analytics-info-panel" role="note">
        <strong>{label}</strong>
        <div>{children}</div>
      </div>
    </details>
  );
}
