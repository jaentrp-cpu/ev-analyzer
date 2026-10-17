import assert from 'node:assert/strict';
import test from 'node:test';
import { BETS_PER_PAGE, paginateBets } from './mybets-pagination.js';

test('955 bets render one 20-row page with an x/y position', () => {
  const bets = Array.from({ length: 955 }, (_, index) => ({ id: index + 1 }));
  const first = paginateBets(bets, 1);
  const middle = paginateBets(bets, 24);
  const last = paginateBets(bets, 48);

  assert.equal(BETS_PER_PAGE, 20);
  assert.equal(first.items.length, 20);
  assert.equal(first.page, 1);
  assert.equal(first.pageCount, 48);
  assert.equal(`${first.page}/${first.pageCount}`, '1/48');
  assert.deepEqual(middle.items.map(item => item.id), bets.slice(460, 480).map(item => item.id));
  assert.equal(`${middle.page}/${middle.pageCount}`, '24/48');
  assert.equal(last.items.length, 15);
});

test('desktop and mobile receive the same clamped page items', () => {
  const bets = Array.from({ length: 955 }, (_, index) => ({ id: index + 1 }));
  const pagination = paginateBets(bets, 99);
  const desktopRows = pagination.items;
  const mobileCards = pagination.items;

  assert.equal(pagination.page, 48);
  assert.strictEqual(desktopRows, mobileCards);
  assert.deepEqual(desktopRows.map(item => item.id), bets.slice(940).map(item => item.id));
});
