import test from 'node:test';
import assert from 'node:assert/strict';
import { isUnrecoverableSessionError, loadBrowserSession } from './auth-session.js';

function fixture(result) {
  const calls = [];
  return {
    calls,
    client: {
      auth: {
        async getSession() {
          calls.push(['getSession']);
          return result;
        },
        async signOut(options) {
          calls.push(['signOut', options]);
          return { error: null };
        },
      },
    },
  };
}

test('keeps a valid browser session without signing out', async () => {
  const session = { user: { id: 'u' } };
  const f = fixture({ data: { session }, error: null });
  assert.deepEqual(await loadBrowserSession(f.client), { session, expired: false });
  assert.deepEqual(f.calls, [['getSession']]);
});

test('clears only local credentials for an unrecoverable refresh token', async () => {
  const f = fixture({
    data: { session: null },
    error: { code: 'refresh_token_not_found', message: 'Refresh Token Not Found' },
  });
  assert.deepEqual(await loadBrowserSession(f.client), { session: null, expired: true });
  assert.deepEqual(f.calls, [['getSession'], ['signOut', { scope: 'local' }]]);
});

test('does not turn a transient auth outage into a logout', async () => {
  const error = new Error('network unavailable');
  const f = fixture({ data: { session: null }, error });
  await assert.rejects(loadBrowserSession(f.client), error);
  assert.deepEqual(f.calls, [['getSession']]);
});

test('recognizes the server refresh-token error variants', () => {
  assert.equal(isUnrecoverableSessionError({ message: 'Invalid Refresh Token' }), true);
  assert.equal(isUnrecoverableSessionError({ code: 'refresh_token_already_used' }), true);
  assert.equal(isUnrecoverableSessionError({ message: 'timeout' }), false);
});
