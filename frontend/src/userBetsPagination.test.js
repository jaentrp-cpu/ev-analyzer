import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPagedRows } from './userBetsPagination.js';

test('loads one partial page without an extra request', async () => {
  const calls = [];
  const result = await loadPagedRows(async (from, to) => {
    calls.push([from, to]);
    return { data: [{ id: 1 }, { id: 2 }], error: null };
  }, 3);
  assert.deepEqual(calls, [[0, 2]]);
  assert.deepEqual(result.data.map(row => row.id), [1, 2]);
});

test('loads additional pages and removes duplicate IDs', async () => {
  const pages = [
    [{ id: 4 }, { id: 3 }],
    [{ id: 3 }, { id: 2 }],
    [{ id: 1 }],
  ];
  let call = 0;
  const result = await loadPagedRows(async () => ({ data: pages[call++], error: null }), 2);
  assert.equal(call, 3);
  assert.deepEqual(result.data.map(row => row.id), [4, 3, 2, 1]);
});

test('does not expose incomplete data when a later page fails', async () => {
  let call = 0;
  const error = new Error('page failed');
  const result = await loadPagedRows(async () => {
    call += 1;
    return call === 1
      ? { data: [{ id: 1 }, { id: 2 }], error: null }
      : { data: null, error };
  }, 2);
  assert.equal(result.data, null);
  assert.equal(result.error, error);
});

test('handles the Supabase 1000-row boundary without truncation', async () => {
  for (const total of [999, 1000, 1001]) {
    const source = Array.from({ length: total }, (_, index) => ({ id: index + 1 }));
    let calls = 0;
    const result = await loadPagedRows(async (from, to) => {
      calls += 1;
      return { data: source.slice(from, to + 1), error: null };
    });
    assert.equal(result.data.length, total);
    assert.equal(calls, total < 1000 ? 1 : 2);
  }
});
