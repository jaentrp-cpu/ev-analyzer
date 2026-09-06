import test from 'node:test';
import assert from 'node:assert/strict';
import { createSteamBetSnapshot } from './steam-bet-snapshot.js';

test('captures only immutable Steam display fields', () => {
  const snapshot = createSteamBetSnapshot({
    id: 'source-1',
    match: 'Home vs Away',
    steamDisplayScore: 84,
    steamDisplayLabel: 'yleinen sääntö',
    steamModelVersion: 'v0',
    legacySteamScore: null,
  }, '2026-09-07T00:00:00.000Z');

  assert.deepEqual(snapshot, {
    schema_version: 1,
    captured_at: '2026-09-07T00:00:00.000Z',
    display: {
      steamDisplayScore: 84,
      steamDisplayLabel: 'yleinen sääntö',
      steamModelVersion: 'v0',
      legacySteamScore: null,
    },
  });
});

test('does not create a snapshot without Steam data', () => {
  assert.equal(createSteamBetSnapshot({ id: 'source-1', match: 'Home vs Away' }), null);
});
