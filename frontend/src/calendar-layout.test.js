import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('./components/PortfolioAnalytics.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');

test('calendar PnL keeps the exact cents and euro sign without ellipsis', () => {
  assert.match(component, /formatCalendarPnl\(summary\.pnl\)/);
  assert.doesNotMatch(component, /formatCalendarPnl\(summary\.pnl, 0\)/);
  const rule = styles.match(/\.analytics-calendar-day strong \{[\s\S]*?\}/)?.[0] || '';
  assert.match(rule, /font: 750 clamp\(6px, 13cqi, 11px\)/);
  assert.match(rule, /overflow-wrap: anywhere/);
  assert.match(rule, /white-space: normal/);
  assert.doesNotMatch(rule, /text-overflow:\s*ellipsis/);
});

test('today marker is constrained to its calendar cell', () => {
  const rule = styles.match(/\.analytics-calendar-date i \{[\s\S]*?\}/)?.[0] || '';
  assert.match(rule, /flex: 0 0 100%/);
  assert.match(rule, /max-width: 100%/);
  assert.match(rule, /overflow: hidden/);
  assert.match(rule, /white-space: nowrap/);
});
