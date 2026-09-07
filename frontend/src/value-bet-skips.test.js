import test from 'node:test';
import assert from 'node:assert/strict';
import { applyValueBetSkipEvent, createValueBetSkipStore } from './value-bet-skips.js';

function queryFixture(result = { data: [], error: null }) {
  const calls = [];
  const query = {
    select(value) { calls.push(['select', value]); return this; },
    eq(key, value) { calls.push(['eq', key, value]); return Promise.resolve(result); },
    upsert(value, options) { calls.push(['upsert', value, options]); return Promise.resolve(result); },
    delete() { calls.push(['delete']); return this; },
  };
  const client = { from(table) { calls.push(['from', table]); return query; } };
  return { client, calls };
}

test('loads skips only for the authenticated owner id supplied by the caller', async () => {
  const fixture = queryFixture({ data: [{ source_bet_id: 'bet-1' }], error: null });
  const store = createValueBetSkipStore(fixture.client);
  assert.deepEqual(await store.load('user-a'), ['bet-1']);
  assert.deepEqual(fixture.calls, [
    ['from', 'user_value_bet_skips'],
    ['select', 'source_bet_id'],
    ['eq', 'user_id', 'user-a'],
  ]);
});

test('writes a composite owner and source-bet key', async () => {
  const fixture = queryFixture();
  const store = createValueBetSkipStore(fixture.client);
  await store.add('user-a', 'bet-1');
  assert.deepEqual(fixture.calls[1], [
    'upsert',
    { user_id: 'user-a', source_bet_id: 'bet-1' },
    { onConflict: 'user_id,source_bet_id' },
  ]);
});

test('clear is always scoped to one owner', async () => {
  const fixture = queryFixture();
  const store = createValueBetSkipStore(fixture.client);
  await store.clear('user-b');
  assert.deepEqual(fixture.calls, [
    ['from', 'user_value_bet_skips'],
    ['delete'],
    ['eq', 'user_id', 'user-b'],
  ]);
});

test('realtime events from another owner cannot change local state', () => {
  const current = ['bet-1'];
  assert.equal(applyValueBetSkipEvent(current, {
    eventType: 'INSERT',
    new: { user_id: 'user-b', source_bet_id: 'bet-2' },
  }, 'user-a'), current);
  assert.deepEqual(applyValueBetSkipEvent(current, {
    eventType: 'INSERT',
    new: { user_id: 'user-a', source_bet_id: 'bet-2' },
  }, 'user-a'), ['bet-1', 'bet-2']);
  assert.deepEqual(applyValueBetSkipEvent(['bet-1', 'bet-2'], {
    eventType: 'DELETE',
    old: { user_id: 'user-a', source_bet_id: 'bet-1' },
  }, 'user-a'), ['bet-2']);
});

test('subscription is filtered to exactly one owner', () => {
  const calls = [];
  const channel = {
    on(kind, config, handler) { calls.push(['on', kind, config, typeof handler]); return this; },
    subscribe() { calls.push(['subscribe']); return this; },
  };
  const client = {
    channel(name) { calls.push(['channel', name]); return channel; },
    removeChannel(value) { calls.push(['removeChannel', value]); },
  };
  const unsubscribe = createValueBetSkipStore(client).subscribe('user-a', () => {});
  assert.deepEqual(calls.slice(0, 3), [
    ['channel', 'value-bet-skips:user-a'],
    ['on', 'postgres_changes', {
      event: '*', schema: 'public', table: 'user_value_bet_skips', filter: 'user_id=eq.user-a',
    }, 'function'],
    ['subscribe'],
  ]);
  unsubscribe();
  assert.deepEqual(calls[3], ['removeChannel', channel]);
});
