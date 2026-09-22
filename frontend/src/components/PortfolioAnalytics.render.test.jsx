import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PortfolioAnalytics from './PortfolioAnalytics.jsx';

const bets = Array.from({ length: 955 }, (_, index) => ({
  _dbId: `bet-${index}`,
  sourceBetId: String(index + 1),
  status: index % 3 === 0 ? 'won' : 'lost',
  result: index % 3 === 0 ? 'won' : 'lost',
  stake: 10 + (index % 25),
  pnl: index % 3 === 0 ? 8 : -10,
  ev: index % 11 === 0 ? null : 3 + (index % 6),
  odds: 1.8 + (index % 7) / 10,
  clvOdds: index % 4 === 0 ? 2.05 : null,
  clvPct: index % 4 === 0 ? 2.5 : null,
  clvVerified: index % 8 === 0,
  clvPhase: index % 8 === 0 ? 'closing' : null,
  createdAt: new Date(Date.UTC(2026, 8, 1, 0, index % 60)).toISOString(),
  match: `Fixture ${index}`,
  bookmaker: 'FixtureBook',
  market: 'h2h',
}));

const html = renderToStaticMarkup(
  <PortfolioAnalytics
    userBets={bets}
    bankroll={1000}
    startingBankroll={500}
    totalBankroll={1200}
    canViewAdvanced
    range="all"
  />,
);

if (!html.includes('EV-odotusarvo') || !html.includes('CLV-proxy')) {
  throw new Error('Projection curves did not render');
}
if (!html.includes('CLV 239/955')) {
  throw new Error('Stored CLV coverage did not render');
}
console.log('PortfolioAnalytics 955-row render passed');
