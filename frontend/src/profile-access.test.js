import test from 'node:test';
import assert from 'node:assert/strict';
import { readProfileWithRecovery } from './profile-access.js';
function fixture(results, sessionId = 'u', refreshError = null) {
  const counts = { reads: 0, refreshes: 0 };
  const client = {
    from(table) { assert.equal(table, 'profiles'); return this; },
    select(columns) { assert.equal(columns, 'username, avatar_url, tier_code'); return this; },
    eq(key, id) { assert.equal(key, 'id'); assert.equal(id, 'u'); return this; },
    abortSignal(signal) { assert.ok(signal instanceof AbortSignal); return this; },
    async maybeSingle() { return results[counts.reads++]; },
    auth: { async refreshSession() {
      counts.refreshes++;
      return { data: { session: sessionId ? { user: { id: sessionId } } : null }, error: refreshError };
    } },
  };
  return { client, counts };
}
const ok = tier => ({ status: 200, data: { tier_code: tier }, error: null });
const jwt = { status: 401, error: { code: 'PGRST303' } };
test('valid tiers are returned unchanged without refresh', async () => {
  for (const tier of ['all_star', 'rookie_value', 'none']) {
    const f = fixture([ok(tier)]);
    assert.equal((await readProfileWithRecovery(f.client, 'u')).tier_code, tier);
    assert.deepEqual(f.counts, { reads: 1, refreshes: 0 });
  }
});
test('JWT failure permits exactly one refresh and profile retry', async () => {
  const f = fixture([jwt, ok('all_star')]);
  assert.equal((await readProfileWithRecovery(f.client, 'u')).tier_code, 'all_star');
  assert.deepEqual(f.counts, { reads: 2, refreshes: 1 });
});
test('persistent JWT rejection fails closed, no loop', async () => {
  const f = fixture([jwt, jwt]);
  await assert.rejects(readProfileWithRecovery(f.client, 'u'), /PROFILE_READ_FAILED/);
  assert.deepEqual(f.counts, { reads: 2, refreshes: 1 });
});
test('refresh failure, logout and changed identity never retry as original user', async () => {
  for (const [id, error] of [['u', new Error('failure')], [null, null], ['other', null]]) {
    const f = fixture([jwt], id, error);
    await assert.rejects(readProfileWithRecovery(f.client, 'u'), /PROFILE_AUTH_RECOVERY_FAILED/);
    assert.equal(f.counts.reads, 1);
  }
});
test('non-auth errors and missing profile cannot become tier none', async () => {
  for (const result of [{ status: 503, error: { message: 'unavailable' } }, { status: 200, data: null }]) {
    const f = fixture([result]);
    await assert.rejects(readProfileWithRecovery(f.client, 'u'), /PROFILE_(READ_FAILED|NOT_FOUND)/);
    assert.equal(f.counts.refreshes, 0);
  }
});
