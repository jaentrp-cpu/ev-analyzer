const UNRECOVERABLE_SESSION_CODES = new Set([
  'refresh_token_not_found',
  'refresh_token_already_used',
]);

export function isUnrecoverableSessionError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return UNRECOVERABLE_SESSION_CODES.has(code)
    || message.includes('refresh token not found')
    || message.includes('invalid refresh token');
}

export async function loadBrowserSession(client) {
  const { data, error } = await client.auth.getSession();
  if (!error) return { session: data?.session || null, expired: false };
  if (!isUnrecoverableSessionError(error)) throw error;

  // A revoked refresh token cannot recover by retrying. Remove only this
  // browser's stale credentials so protected requests never fall back to anon.
  await client.auth.signOut({ scope: 'local' });
  return { session: null, expired: true };
}
