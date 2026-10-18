import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('./components/PortfolioAnalytics.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

test('calendar PnL is exact and readable without ellipsis on desktop and mobile', () => {
  assert.match(component, /className="calendar-pnl-desktop">\{formatCalendarPnl\(summary\.pnl\)\}/);
  assert.match(component, /className="calendar-pnl-mobile">\{formatMobileCalendarPnl\(summary\.pnl\)\}/);
  assert.match(component, /formatCalendarPnl\(value, digits\)\.replace\(\/\\s\+\/g, ''\)/);
  assert.doesNotMatch(component, /formatCalendarPnl\(summary\.pnl, 0\)/);
  const rule = styles.match(/\.analytics-calendar-day strong \{[\s\S]*?\}/)?.[0] || '';
  assert.match(rule, /font: 750 11px/);
  assert.match(rule, /overflow-wrap: anywhere/);
  assert.match(rule, /white-space: normal/);
  assert.doesNotMatch(rule, /text-overflow:\s*ellipsis/);
  assert.match(styles, /\.vdx\.is-mobile \.analytics-calendar-day strong \{[\s\S]*?font-size: clamp\(6\.5px, 1\.8vw, 7\.5px\)/);
  assert.match(styles, /\.vdx\.is-mobile \.calendar-pnl-desktop \{ display: none; \}/);
  assert.match(styles, /\.vdx\.is-mobile \.calendar-pnl-mobile \{[\s\S]*?display: block;[\s\S]*?overflow: hidden/);
});

test('calendar keeps the today border without rendering a today text marker', () => {
  assert.match(component, /key === todayKey \? ' today' : ''/);
  assert.doesNotMatch(component, /<i>Tänään<\/i>/);
  assert.match(styles, /\.analytics-calendar-day\.today \{[\s\S]*?box-shadow:/);
});

test('calendar stake stays visible on desktop but mobile shows only the PnL line', () => {
  assert.match(component, /className="calendar-stake">\{formatEuro\(summary\.totalStake\)\} panos/);
  const rule = styles.match(/\.analytics-calendar-day \.calendar-stake \{[\s\S]*?\}/)?.[0] || '';
  assert.match(rule, /overflow: visible/);
  assert.match(rule, /overflow-wrap: anywhere/);
  assert.match(rule, /text-overflow: clip/);
  assert.match(rule, /white-space: normal/);
  assert.match(styles, /\.vdx\.is-mobile \.analytics-calendar-day \.calendar-bet-count,[\s\S]*?\.calendar-stake \{[\s\S]*?display: none/);
  assert.match(styles, /\.vdx\.is-mobile \.analytics-calendar-day strong \{[\s\S]*?white-space: nowrap/);
});
