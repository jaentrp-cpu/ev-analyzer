// A failed read must never become a missing subscription.
export async function readProfileWithRecovery(client, userId) {
  const read = () => client.from('profiles')
    .select('username, avatar_url, tier_code').eq('id', userId)
    .abortSignal(AbortSignal.timeout(10000)).maybeSingle();
  let result = await read();
  if (result.status === 401 || result.error?.code === 'PGRST303') {
    const { data, error } = await client.auth.refreshSession();
    if (error || data?.session?.user?.id !== userId) {
      throw new Error('PROFILE_AUTH_RECOVERY_FAILED');
    }
    result = await read();
  }
  if (result.error) throw new Error('PROFILE_READ_FAILED');
  if (!result.data) throw new Error('PROFILE_NOT_FOUND');
  return result.data;
}
